use std::collections::BTreeMap;

use serde::Serialize;
use tauri::State;

use super::dependencies::{collect_locals, index_maps, is_vendored, resolve};
use super::luau_lex::{lex_spanned, parse_chain_at, ChainArg, Tok};
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameEdit {
    pub file: String,
    pub line: usize,
    pub before: String,
    pub after: String,
}

fn line_of(line_starts: &[usize], off: usize) -> usize {
    line_starts.partition_point(|&s| s <= off) - 1
}

// Precise cross-file edits to rename module `file` to `new_name`: require chains
// that resolve to it (via the owned dep graph) plus `:WaitForChild`/
// `:FindFirstChild` string literals naming it. Returns line-level edits; the
// caller previews/applies them, then renames the file. Replaces the old
// word-boundary regex pass, which hit false positives and broke init folders.
#[tauri::command]
pub fn project_rename_edits(
    store: State<'_, ProjectStore>,
    file: String,
    new_name: String,
) -> Result<Vec<RenameEdit>, String> {
    let (root, project_file) = {
        let guard = store.0.lock().unwrap();
        let m = guard.as_ref().ok_or("No project open")?;
        (m.root.clone(), m.project_file.clone())
    };
    let file = file.replace('\\', "/");
    let tree = super::sourcemap::generate(&root, &project_file).ok_or("No sourcemap")?;
    let (_, file_to_chain, root_name, services) = index_maps(&tree);
    let old_chain = file_to_chain.get(&file).cloned().ok_or("File not in model")?;
    let old_name = old_chain.last().cloned().ok_or("Module has no name")?;
    if old_name == new_name {
        return Ok(Vec::new());
    }

    let mut edits = Vec::new();
    for (rfile, rchain) in &file_to_chain {
        if rfile == &file || is_vendored(rfile) {
            continue;
        }
        let content = match std::fs::read_to_string(root.join(rfile)) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let spanned = lex_spanned(&content);
        let plain: Vec<Tok> = spanned.iter().map(|t| t.kind.clone()).collect();
        let locals = collect_locals(&plain, rchain, &root_name, &services);

        // (byte start, byte end, replacement) on the renamed instance's name.
        let mut reps: Vec<(usize, usize, String)> = Vec::new();
        for i in 0..plain.len() {
            match &plain[i] {
                Tok::Ident(n)
                    if n == "require" && plain.get(i + 1) == Some(&Tok::LParen) =>
                {
                    if let Some((ChainArg::Path(segs), end)) = parse_chain_at(&plain, i + 2) {
                        let hit = resolve(&segs, Some(rchain), &root_name, &services, &locals)
                            .as_ref()
                            == Some(&old_chain);
                        if hit {
                            if let Some(tok) = spanned.get(end - 1) {
                                if tok.kind == Tok::Ident(old_name.clone()) {
                                    reps.push((tok.start, tok.end, new_name.clone()));
                                }
                            }
                        }
                    }
                }
                Tok::Ident(m)
                    if (m == "WaitForChild" || m == "FindFirstChild")
                        && i > 0
                        && plain[i - 1] == Tok::Colon
                        && plain.get(i + 1) == Some(&Tok::LParen) =>
                {
                    if let (Some(Tok::Str(s)), Some(st)) = (plain.get(i + 2), spanned.get(i + 2)) {
                        if s == &old_name && st.end > st.start + 2 {
                            reps.push((st.start + 1, st.end - 1, new_name.clone()));
                        }
                    }
                }
                _ => {}
            }
        }
        if reps.is_empty() {
            continue;
        }

        let mut line_starts = vec![0usize];
        for (idx, b) in content.bytes().enumerate() {
            if b == b'\n' {
                line_starts.push(idx + 1);
            }
        }
        let lines: Vec<&str> = content.split('\n').collect();
        let mut by_line: BTreeMap<usize, Vec<(usize, usize, String)>> = BTreeMap::new();
        for (s, e, rep) in reps {
            by_line.entry(line_of(&line_starts, s)).or_default().push((s, e, rep));
        }
        for (li, mut group) in by_line {
            let raw = lines.get(li).copied().unwrap_or("");
            let before = raw.strip_suffix('\r').unwrap_or(raw).to_string();
            let base = line_starts[li];
            group.sort_by(|a, b| b.0.cmp(&a.0));
            let mut after = raw.to_string();
            for (s, e, rep) in &group {
                after.replace_range((s - base)..(e - base), rep);
            }
            let after = after.strip_suffix('\r').unwrap_or(&after).to_string();
            edits.push(RenameEdit {
                file: rfile.clone(),
                line: li + 1,
                before,
                after,
            });
        }
    }
    edits.sort_by(|a, b| (&a.file, a.line).cmp(&(&b.file, b.line)));
    Ok(edits)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_of_maps_offsets() {
        let starts = vec![0usize, 6, 12]; // "abcde\nfghij\n..."
        assert_eq!(line_of(&starts, 0), 0);
        assert_eq!(line_of(&starts, 5), 0);
        assert_eq!(line_of(&starts, 6), 1);
        assert_eq!(line_of(&starts, 11), 1);
        assert_eq!(line_of(&starts, 12), 2);
    }

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
