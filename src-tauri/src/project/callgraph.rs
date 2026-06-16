use std::path::Path;

use serde::Serialize;
use tauri::State;

use super::lex_util::{
    is_ident_part, is_ident_start, long_bracket_level, read_quoted, skip_long_bracket,
};
use super::ProjectStore;

const SKIP_DIRS: &[&str] = &["node_modules", "target", "dist", "build"];
const SCRIPT_EXT: [&str; 2] = [".luau", ".lua"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallerSite {
    pub caller: String, // enclosing function name (or the file's base name at top level)
    pub file: String,
    pub line: u32,
    pub column: u32,
}

enum K {
    Word(String),
    Dot,
    Colon,
    LParen,
    Other,
}

struct Tok {
    line: u32,
    col: u32,
    k: K,
}

// Tokenize tracking line/column, reusing lex_util so strings/comments don't
// produce false words.
fn scan(src: &str) -> Vec<Tok> {
    let b = src.as_bytes();
    let n = b.len();
    let mut i = 0;
    let mut line: u32 = 1;
    let mut line_start: usize = 0;
    let mut out = Vec::new();

    // advance helper that counts newlines across a skipped region
    macro_rules! jump {
        ($ni:expr) => {{
            let ni = $ni;
            for k in i..ni {
                if b[k] == b'\n' {
                    line += 1;
                    line_start = k + 1;
                }
            }
            i = ni;
        }};
    }

    while i < n {
        let c = b[i];
        let col = (i - line_start) as u32 + 1;
        match c {
            b'\n' => {
                line += 1;
                line_start = i + 1;
                i += 1;
            }
            b' ' | b'\t' | b'\r' => i += 1,
            b'-' if b.get(i + 1) == Some(&b'-') => {
                let after = i + 2;
                if let Some(level) = long_bracket_level(b, after) {
                    jump!(skip_long_bracket(b, after, level));
                } else {
                    let mut j = after;
                    while j < n && b[j] != b'\n' {
                        j += 1;
                    }
                    i = j;
                }
            }
            b'"' | b'\'' => {
                let (_, ni) = read_quoted(b, i, c);
                jump!(ni);
            }
            b'[' if long_bracket_level(b, i).is_some() => {
                let level = long_bracket_level(b, i).unwrap();
                jump!(skip_long_bracket(b, i, level));
            }
            b'.' => {
                out.push(Tok { line, col, k: K::Dot });
                i += 1;
            }
            b':' => {
                out.push(Tok { line, col, k: K::Colon });
                i += 1;
            }
            b'(' => {
                out.push(Tok { line, col, k: K::LParen });
                i += 1;
            }
            _ if is_ident_start(c) => {
                let start = i;
                i += 1;
                while i < n && is_ident_part(b[i]) {
                    i += 1;
                }
                out.push(Tok {
                    line,
                    col,
                    k: K::Word(src[start..i].to_string()),
                });
            }
            _ => {
                out.push(Tok { line, col, k: K::Other });
                i += 1;
            }
        }
    }
    out
}

const OPENERS: [&str; 4] = ["if", "function", "repeat", "do"];

// last segment of a function definition name (a / a.b / a:b), advancing `i`
// past it. None when the function is anonymous.
fn read_def_name(toks: &[Tok], i: &mut usize) -> Option<String> {
    let mut name = match toks.get(*i) {
        Some(Tok { k: K::Word(w), .. }) => {
            *i += 1;
            w.clone()
        }
        _ => return None,
    };
    loop {
        match (toks.get(*i), toks.get(*i + 1)) {
            (Some(Tok { k: K::Dot, .. }), Some(Tok { k: K::Word(w), .. }))
            | (Some(Tok { k: K::Colon, .. }), Some(Tok { k: K::Word(w), .. })) => {
                name = w.clone();
                *i += 2;
            }
            _ => break,
        }
    }
    Some(name)
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

// Collect every call to `callee` in this file, attributed to the enclosing
// function (or the file base name at top level).
fn scan_file(rel: &str, src: &str, callee: &str, out: &mut Vec<CallerSite>) {
    let toks = scan(src);
    let top = base_name(rel);
    // (function name, block depth at definition)
    let mut frames: Vec<(String, i32)> = Vec::new();
    let mut depth: i32 = 0;
    let mut expect_loop_do = false;

    let mut i = 0;
    while i < toks.len() {
        if let K::Word(w) = &toks[i].k {
            match w.as_str() {
                "function" => {
                    depth += 1;
                    let mut j = i + 1;
                    let name = read_def_name(&toks, &mut j);
                    if let Some(n) = name {
                        frames.push((n, depth));
                    }
                    i = j;
                    continue;
                }
                "for" | "while" => {
                    depth += 1;
                    expect_loop_do = true;
                }
                "if" => depth += 1,
                "repeat" => depth += 1,
                "do" => {
                    if expect_loop_do {
                        expect_loop_do = false;
                    } else {
                        depth += 1;
                    }
                }
                "until" => depth -= 1,
                "end" => {
                    if let Some((_, d)) = frames.last() {
                        if *d == depth {
                            frames.pop();
                        }
                    }
                    depth -= 1;
                }
                "elseif" | "else" | "then" => {}
                other if !OPENERS.contains(&other) => {
                    if matches!(toks.get(i + 1).map(|t| &t.k), Some(K::LParen)) && other == callee {
                        let caller = frames
                            .last()
                            .map(|(n, _)| n.clone())
                            .unwrap_or_else(|| top.clone());
                        out.push(CallerSite {
                            caller,
                            file: rel.to_string(),
                            line: toks[i].line,
                            column: toks[i].col,
                        });
                    }
                }
                _ => {}
            }
        }
        i += 1;
    }
}

fn walk(root: &Path, dir: &Path, callee: &str, out: &mut Vec<CallerSite>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        if path.is_dir() {
            if name.starts_with('.') || SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            walk(root, &path, callee, out);
        } else if SCRIPT_EXT.iter().any(|e| name.ends_with(e)) {
            if let Ok(src) = std::fs::read_to_string(&path) {
                let rel = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");
                scan_file(&rel, &src, callee, out);
            }
        }
    }
}

#[tauri::command]
pub fn project_callers(store: State<'_, ProjectStore>, name: String) -> Vec<CallerSite> {
    let root = match store.0.lock().unwrap().as_ref().map(|m| m.root.clone()) {
        Some(r) => r,
        None => return vec![],
    };
    let name = name.trim();
    if name.is_empty() {
        return vec![];
    }
    let mut out = Vec::new();
    walk(&root, &root, name, &mut out);
    out
}
