use tauri::State;

use super::ProjectStore;

// Files that statically require `file`, via the owned dependency graph.
#[tauri::command]
pub fn project_requirers(store: State<'_, ProjectStore>, file: String) -> Vec<String> {
    let Some((root, project_file)) = ({
        let guard = store.0.lock().unwrap();
        guard.as_ref().map(|m| (m.root.clone(), m.project_file.clone()))
    }) else {
        return Vec::new();
    };
    let Some(tree) = super::sourcemap::generate(&root, &project_file) else {
        return Vec::new();
    };
    let mut out: Vec<String> = super::dependencies::build(&root, &tree)
        .edges
        .into_iter()
        .filter(|e| e.to == file)
        .map(|e| e.from)
        .collect();
    out.sort();
    out.dedup();
    out
}

// alias of a `local Alias = require(...)` line, else None.
fn require_alias(line: &str) -> Option<&str> {
    let rest = line.trim_start().strip_prefix("local ")?;
    let (lhs, rhs) = rest.split_once('=')?;
    let alias = lhs.trim();
    let ok = !alias.is_empty()
        && !alias.contains(',')
        && alias.chars().all(|c| c == '_' || c.is_ascii_alphanumeric())
        && rhs.trim_start().starts_with("require");
    ok.then_some(alias)
}

// Sort each contiguous run of `local X = require(...)` lines by alias. Returns the
// new file text if anything moved, else None. Adjacent-only keeps it safe.
fn organize(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    let mut out: Vec<&str> = Vec::with_capacity(lines.len());
    let mut changed = false;
    let mut i = 0;
    while i < lines.len() {
        if require_alias(lines[i]).is_some() {
            let mut j = i;
            while j < lines.len() && require_alias(lines[j]).is_some() {
                j += 1;
            }
            let mut group: Vec<&str> = lines[i..j].to_vec();
            let original = group.clone();
            group.sort_by_key(|l| require_alias(l).unwrap_or("").to_lowercase());
            if group != original {
                changed = true;
            }
            out.extend(group);
            i = j;
        } else {
            out.push(lines[i]);
            i += 1;
        }
    }
    if !changed {
        return None;
    }
    let mut text = out.join("\n");
    if content.ends_with('\n') {
        text.push('\n');
    }
    Some(text)
}

// Returns the reorganized file text (caller applies it as a model edit), or None
// if requires were already sorted.
#[tauri::command]
pub fn project_organize_requires(
    store: State<'_, ProjectStore>,
    file: String,
) -> Result<Option<String>, String> {
    let root = store.root().ok_or("No project open")?;
    let content = std::fs::read_to_string(root.join(&file)).map_err(|e| e.to_string())?;
    Ok(organize(&content))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sorts_adjacent_requires() {
        let src = "local Zoo = require(a)\nlocal Ant = require(b)\nlocal x = 1\n";
        let out = organize(src).expect("should change");
        assert!(out.starts_with("local Ant = require(b)\nlocal Zoo = require(a)\n"));
        assert!(out.ends_with("local x = 1\n"));
    }

    #[test]
    fn leaves_sorted_untouched() {
        let src = "local Ant = require(b)\nlocal Zoo = require(a)\n";
        assert!(organize(src).is_none());
    }

    #[test]
    fn groups_break_on_blank_lines() {
        // each require is its own group → nothing to reorder
        let src = "local Zoo = require(a)\n\nlocal Ant = require(b)\n";
        assert!(organize(src).is_none());
    }
}
