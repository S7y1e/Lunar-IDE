use std::collections::BTreeMap;
use std::path::Path;

use serde::Deserialize;
use tauri::State;

use super::ProjectStore;

// Hidden marker appended to every injected line, so disarm can find and strip
// exactly the lines Lunar added — no more, no less.
const MARKER: &str = "--[[lunar:lp]]";
const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", "build", ".git", "Packages"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Logpoint {
    pub file: String, // project-relative, "/"-separated
    pub line: u32,    // 1-based; the print is inserted *before* this line
    pub expr: String,
    #[serde(default)]
    pub include_stack: bool,
}

fn leading_ws(line: &str) -> &str {
    let end = line.find(|c: char| c != ' ' && c != '\t').unwrap_or(line.len());
    &line[..end]
}

fn lua_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

fn render(point: &Logpoint, indent: &str) -> String {
    let label = lua_string(&format!("[Lunar lp] {} =", point.expr));
    if point.include_stack {
        format!(
            "{indent}print(\"{label}\", {expr}, \"\\n\" .. debug.traceback()) {MARKER}",
            expr = point.expr,
        )
    } else {
        format!("{indent}print(\"{label}\", {expr}) {MARKER}", expr = point.expr)
    }
}

#[tauri::command]
pub fn logpoints_arm(
    store: State<'_, ProjectStore>,
    points: Vec<Logpoint>,
) -> Result<(), String> {
    let root = store.0.lock().unwrap().as_ref().map(|m| m.root.clone())
        .ok_or("No project open")?;

    // Always start from a clean slate so re-arming never stacks duplicates.
    strip_all(&root)?;

    // Group by file, then insert bottom-up so earlier inserts don't shift the
    // line numbers of later ones.
    let mut by_file: BTreeMap<&str, Vec<&Logpoint>> = BTreeMap::new();
    for p in &points {
        by_file.entry(p.file.as_str()).or_default().push(p);
    }

    for (rel, mut group) in by_file {
        let path = root.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let mut lines: Vec<String> = text.lines().map(|l| l.to_string()).collect();

        group.sort_by(|a, b| b.line.cmp(&a.line));
        for p in group {
            let idx = (p.line as usize).saturating_sub(1).min(lines.len());
            let indent = lines.get(idx).map(|l| leading_ws(l).to_string()).unwrap_or_default();
            lines.insert(idx, render(p, &indent));
        }

        std::fs::write(&path, lines.join("\n") + "\n").map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn logpoints_disarm(store: State<'_, ProjectStore>) -> Result<(), String> {
    let root = store.0.lock().unwrap().as_ref().map(|m| m.root.clone())
        .ok_or("No project open")?;
    strip_all(&root)
}

// Remove every Lunar-injected line across the project.
fn strip_all(root: &Path) -> Result<(), String> {
    strip_dir(root)
}

fn strip_dir(dir: &Path) -> Result<(), String> {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Ok(()),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if path.is_dir() {
            if !name.starts_with('.') && !SKIP_DIRS.contains(&name.as_str()) {
                strip_dir(&path)?;
            }
        } else if matches!(
            path.extension().and_then(|e| e.to_str()),
            Some("lua") | Some("luau")
        ) {
            strip_file(&path)?;
        }
    }
    Ok(())
}

fn strip_file(path: &Path) -> Result<(), String> {
    let text = match std::fs::read_to_string(path) {
        Ok(t) => t,
        Err(_) => return Ok(()),
    };
    if !text.contains(MARKER) {
        return Ok(());
    }
    let kept: Vec<&str> = text.lines().filter(|l| !l.contains(MARKER)).collect();
    std::fs::write(path, kept.join("\n") + "\n").map_err(|e| e.to_string())
}
