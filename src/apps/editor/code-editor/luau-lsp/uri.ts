export function pathToUri(path: string): string {
    let normalized = path.replace(/\\/g, "/");
    if (!normalized.startsWith("/")) normalized = "/" + normalized;
    return "file://" + encodeURI(normalized);
}

// Canonical form so paths from different sources (file tree vs. LSP go-to-def)
// compare equal: backslash separators and an upper-case Windows drive letter.
// luau-lsp emits the drive lower-case, the tree upper-case — without this they
// dedupe as two different files and a duplicate tab opens.
export function canonicalPath(path: string): string {
    let p = path.replace(/\//g, "\\");
    if (/^[a-z]:/.test(p)) p = p[0].toUpperCase() + p.slice(1);
    return p;
}

export function uriToPath(uri: string): string {
    let path = uri.replace(/^file:\/\//, "");
    try {
        // decodeURIComponent (not decodeURI) so the drive colon survives: LSP
        // servers emit it percent-encoded on Windows (file:///c%3A/...), and
        // decodeURI leaves reserved chars like ":" encoded.
        path = decodeURIComponent(path);
    } catch {}
    if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
    return path.replace(/\//g, "\\");
}
