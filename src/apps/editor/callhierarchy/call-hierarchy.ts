import { getCurrentLspClient } from "../code-editor/luau-lsp/lsp-registry";
import type {
    LspLocation,
    LspDocumentSymbol,
    LspPosition,
    LspRange,
} from "../code-editor/luau-lsp/convert";

// A caller: a call site + the function that encloses it (which we recurse into).
export type CallNode = {
    id: string;
    label: string; // enclosing function name (the caller)
    fnUri: string; // caller function location, for finding ITS callers
    fnPos: LspPosition;
    siteUri: string; // the call site, for navigation
    siteLine: number; // 1-based
    siteColumn: number;
};

function inRange(range: LspRange, pos: LspPosition): boolean {
    const afterStart =
        pos.line > range.start.line ||
        (pos.line === range.start.line && pos.character >= range.start.character);
    const beforeEnd =
        pos.line < range.end.line ||
        (pos.line === range.end.line && pos.character <= range.end.character);
    return afterStart && beforeEnd;
}

// Deepest symbol whose range contains pos.
function enclosing(
    symbols: LspDocumentSymbol[],
    pos: LspPosition
): LspDocumentSymbol | null {
    for (const sym of symbols) {
        if (inRange(sym.range, pos)) {
            return (sym.children && enclosing(sym.children, pos)) ?? sym;
        }
    }
    return null;
}

// Who calls the symbol at (uri, position): each reference, mapped to the
// function that encloses it. Uses LSP references + document symbols (both
// supported by luau-lsp). Self-reference at the declaration is dropped.
export async function findCallers(
    uri: string,
    position: LspPosition
): Promise<CallNode[]> {
    const client = getCurrentLspClient();
    if (!client) return [];

    const refs = await client.references(uri, position);
    const locations: LspLocation[] = Array.isArray(refs) ? refs : refs ? [refs] : [];

    const symCache = new Map<string, LspDocumentSymbol[]>();
    const seen = new Set<string>();
    const out: CallNode[] = [];

    for (const loc of locations) {
        const start = loc.range.start;
        // skip the declaration itself
        if (loc.uri === uri && start.line === position.line) continue;

        let symbols = symCache.get(loc.uri);
        if (!symbols) {
            symbols = (await client.documentSymbols(loc.uri)) ?? [];
            symCache.set(loc.uri, symbols);
        }
        const fn = enclosing(symbols, start);
        if (!fn) continue;

        const fnPos = (fn.selectionRange ?? fn.range).start;
        const id = `${loc.uri}:${start.line}:${start.character}`;
        if (seen.has(id)) continue;
        seen.add(id);

        out.push({
            id,
            label: fn.name,
            fnUri: loc.uri,
            fnPos,
            siteUri: loc.uri,
            siteLine: start.line + 1,
            siteColumn: start.character + 1,
        });
    }
    return out;
}
