use std::path::Path;

use serde::Serialize;
use tauri::State;

use super::callgraph::{scan, Tok, K};
use super::ProjectStore;

const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", "build"];
const SCRIPT_EXT: [&str; 2] = [".luau", ".lua"];
const MAX: usize = 1000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Symbol {
    pub name: String,
    pub container: String, // module/table prefix, or the file base name
    pub file: String,
    pub line: u32,
    pub column: u32,
}

fn base_name(rel: &str) -> String {
    let file = rel.rsplit('/').next().unwrap_or(rel);
    for e in SCRIPT_EXT {
        if let Some(stripped) = file.strip_suffix(e) {
            return stripped.to_string();
        }
    }
    file.to_string()
}

// Collect function definitions: `function a.b.c(`, `function a:b(`,
// `local function n(`, `function n(`. Records the last name segment + its
// container (the prefix, or the file base name).
fn collect_defs(rel: &str, src: &str, q: &str, out: &mut Vec<Symbol>) {
    let toks = scan(src);
    let top = base_name(rel);
    let mut i = 0;
    while i < toks.len() {
        let is_fn = matches!(&toks[i].k, K::Word(w) if w == "function");
        if !is_fn {
            i += 1;
            continue;
        }
        // read the name chain after `function`
        let mut j = i + 1;
        let mut container = top.clone();
        let (mut name, mut line, mut col) = match toks.get(j) {
            Some(Tok { k: K::Word(w), line, col }) => {
                j += 1;
                (w.clone(), *line, *col)
            }
            _ => {
                i += 1;
                continue;
            }
        };
        loop {
            match (toks.get(j), toks.get(j + 1)) {
                (Some(Tok { k: K::Dot, .. }), Some(Tok { k: K::Word(w), line: l, col: c }))
                | (Some(Tok { k: K::Colon, .. }), Some(Tok { k: K::Word(w), line: l, col: c })) => {
                    container = name;
                    name = w.clone();
                    line = *l;
                    col = *c;
                    j += 2;
                }
                _ => break,
            }
        }
        if q.is_empty() || name.to_lowercase().contains(q) {
            out.push(Symbol {
                name,
                container,
                file: rel.to_string(),
                line,
                column: col,
            });
        }
        i = j;
    }
}

fn walk(root: &Path, dir: &Path, q: &str, out: &mut Vec<Symbol>) {
    if out.len() >= MAX {
        return;
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if out.len() >= MAX {
            return;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if path.is_dir() {
            if name.starts_with('.') || SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            walk(root, &path, q, out);
        } else if SCRIPT_EXT.iter().any(|e| name.ends_with(e)) {
            if let Ok(src) = std::fs::read_to_string(&path) {
                let rel = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                collect_defs(&rel, &src, q, out);
            }
        }
    }
}

#[tauri::command]
pub fn project_symbols(store: State<'_, ProjectStore>, query: String) -> Vec<Symbol> {
    let root = match store.0.lock().unwrap().as_ref().map(|m| m.root.clone()) {
        Some(r) => r,
        None => return vec![],
    };
    let q = query.trim().to_lowercase();
    let mut out = Vec::new();
    walk(&root, &root, &q, &mut out);
    out
}
