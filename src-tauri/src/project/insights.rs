use std::collections::{HashMap, HashSet};
use std::path::Path;

use serde::Serialize;
use tauri::State;

use super::dependencies::{self, is_vendored, script_file, DependencyEdge};
use super::event_scan::analyze;
use super::{DataModelNode, ProjectStore};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub severity: String,
    pub category: String,
    pub message: String,
    pub file: String,
    pub line: u32,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct Insights {
    pub findings: Vec<Finding>,
}

#[derive(Clone, Copy, PartialEq)]
enum Side {
    Client,
    Server,
    Shared,
}

fn side_of(service: Option<&str>) -> Side {
    match service {
        Some("ServerScriptService") | Some("ServerStorage") => Side::Server,
        Some("StarterPlayer") | Some("StarterGui") | Some("StarterPack")
        | Some("StarterCharacterScripts") => Side::Client,
        _ => Side::Shared,
    }
}

fn base(rel: &str) -> &str {
    rel.rsplit('/').next().unwrap_or(rel)
}

fn stem(rel: &str) -> &str {
    base(rel)
        .trim_end_matches(".luau")
        .trim_end_matches(".lua")
}

// Best-effort 1-based line of the require referencing `needle` in `file`, else 1.
fn require_line(root: &Path, file: &str, needle: &str) -> u32 {
    let content = match std::fs::read_to_string(root.join(file)) {
        Ok(c) => c,
        Err(_) => return 1,
    };
    for (i, line) in content.lines().enumerate() {
        if line.contains("require") && line.contains(needle) {
            return (i + 1) as u32;
        }
    }
    1
}

struct FileInfo {
    file: String,
    class: String,
    chain: Vec<String>,
}

fn walk(node: &DataModelNode, chain: &mut Vec<String>, out: &mut Vec<FileInfo>) {
    chain.push(node.name.clone());
    if let Some(file) = script_file(node) {
        out.push(FileInfo {
            file,
            class: node.class_name.clone(),
            chain: chain.clone(),
        });
    }
    for child in &node.children {
        walk(child, chain, out);
    }
    chain.pop();
}

#[tauri::command]
pub fn project_insights(store: State<'_, ProjectStore>) -> Option<Insights> {
    let (root, project_file) = {
        let guard = store.0.lock().unwrap();
        let m = guard.as_ref()?;
        (m.root.clone(), m.project_file.clone())
    };
    let tree = super::sourcemap::generate(&root, &project_file)?;
    Some(build(&root, &tree))
}

fn finding(severity: &str, category: &str, message: String, file: String, line: u32) -> Finding {
    Finding {
        severity: severity.to_string(),
        category: category.to_string(),
        message,
        file,
        line,
    }
}

pub fn build(root: &Path, tree: &DataModelNode) -> Insights {
    let dep = dependencies::build(root, tree);
    let events = analyze(root, tree);

    let mut files = Vec::new();
    walk(tree, &mut Vec::new(), &mut files);

    let required: HashSet<&str> = dep.edges.iter().map(|e| e.to.as_str()).collect();
    let side: HashMap<&str, Side> = files
        .iter()
        .map(|f| (f.file.as_str(), side_of(f.chain.get(1).map(String::as_str))))
        .collect();

    let mut findings = Vec::new();

    // 7.1 — orphan modules: a ModuleScript nothing statically requires.
    for f in &files {
        if f.class == "ModuleScript" && !is_vendored(&f.file) && !required.contains(f.file.as_str())
        {
            findings.push(finding(
                "warning",
                "orphan",
                format!("Module never required: {}", base(&f.file)),
                f.file.clone(),
                1,
            ));
        }
    }

    // 7.2 — require cycles.
    for cycle in find_cycles(&dep.edges) {
        let label = cycle
            .iter()
            .map(|f| base(f))
            .collect::<Vec<_>>()
            .join(" ↔ ");
        findings.push(finding(
            "warning",
            "cycle",
            format!("Require cycle: {label}"),
            cycle[0].clone(),
            1,
        ));
    }

    // 7.3 — layer violations: a client module requiring a server-only module.
    for e in &dep.edges {
        if side.get(e.from.as_str()) == Some(&Side::Client)
            && side.get(e.to.as_str()) == Some(&Side::Server)
        {
            findings.push(finding(
                "warning",
                "layer",
                format!("Client module requires server-only module: {}", base(&e.to)),
                e.from.clone(),
                require_line(root, &e.from, stem(&e.to)),
            ));
        }
    }

    // 7.4 — dangling events: fired with no listener, or connected with no firer.
    // Only instance-kind signals (real Remote/Bindable) — their fire/connect ids
    // coalesce reliably. Module/custom-signal kinds are too fragile to assert on.
    for s in &events.signals {
        if s.kind == "module" {
            continue;
        }
        if !s.fired_by.is_empty() && s.connected_by.is_empty() {
            findings.push(finding(
                "warning",
                "dangling-event",
                format!("Signal fired but never connected: {}", s.label),
                s.fired_by[0].clone(),
                1,
            ));
        } else if s.fired_by.is_empty() && !s.connected_by.is_empty() {
            findings.push(finding(
                "warning",
                "dangling-event",
                format!("Signal connected but never fired: {}", s.label),
                s.connected_by[0].clone(),
                1,
            ));
        }
    }

    // 7.5 — unresolved requires.
    for u in &dep.unresolved {
        let needle = u
            .expr
            .rsplit(|c: char| c == '.' || c == '/' || c == '"' || c == '\\')
            .find(|s| !s.is_empty())
            .unwrap_or(&u.expr);
        findings.push(finding(
            "info",
            "unresolved",
            format!("Unresolved require: {}", u.expr),
            u.from.clone(),
            require_line(root, &u.from, needle),
        ));
    }

    Insights { findings }
}

struct Tarjan<'a> {
    adj: &'a [Vec<usize>],
    index: usize,
    indices: Vec<Option<usize>>,
    low: Vec<usize>,
    on_stack: Vec<bool>,
    stack: Vec<usize>,
    comps: Vec<Vec<usize>>,
}

impl Tarjan<'_> {
    fn run(&mut self, v: usize) {
        self.indices[v] = Some(self.index);
        self.low[v] = self.index;
        self.index += 1;
        self.stack.push(v);
        self.on_stack[v] = true;
        for w in self.adj[v].clone() {
            if self.indices[w].is_none() {
                self.run(w);
                self.low[v] = self.low[v].min(self.low[w]);
            } else if self.on_stack[w] {
                self.low[v] = self.low[v].min(self.indices[w].unwrap());
            }
        }
        if self.low[v] == self.indices[v].unwrap() {
            let mut comp = Vec::new();
            loop {
                let w = self.stack.pop().unwrap();
                self.on_stack[w] = false;
                comp.push(w);
                if w == v {
                    break;
                }
            }
            self.comps.push(comp);
        }
    }
}

// Strongly-connected components of the require graph; any with >1 node is a cycle.
fn find_cycles(edges: &[DependencyEdge]) -> Vec<Vec<String>> {
    let mut id: HashMap<&str, usize> = HashMap::new();
    let mut names: Vec<&str> = Vec::new();
    for e in edges {
        for s in [e.from.as_str(), e.to.as_str()] {
            if !id.contains_key(s) {
                id.insert(s, names.len());
                names.push(s);
            }
        }
    }
    let n = names.len();
    let mut adj = vec![Vec::new(); n];
    for e in edges {
        adj[id[e.from.as_str()]].push(id[e.to.as_str()]);
    }

    let mut t = Tarjan {
        adj: &adj,
        index: 0,
        indices: vec![None; n],
        low: vec![0; n],
        on_stack: vec![false; n],
        stack: Vec::new(),
        comps: Vec::new(),
    };
    for v in 0..n {
        if t.indices[v].is_none() {
            t.run(v);
        }
    }

    t.comps
        .into_iter()
        .filter(|c| c.len() > 1)
        .map(|c| {
            let mut group: Vec<String> = c.iter().map(|&i| names[i].to_string()).collect();
            group.sort();
            group
        })
        .collect()
}
