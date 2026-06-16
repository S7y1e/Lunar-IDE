export function pathToUri(path: string): string {
    let normalized = path.replace(/\\/g, "/");
    if (!normalized.startsWith("/")) normalized = "/" + normalized;
    return "file://" + encodeURI(normalized);
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
