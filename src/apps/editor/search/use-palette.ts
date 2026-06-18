import { useEffect, useMemo, useState } from "react";
import { ProjectFile, walkProjectFiles } from "../../../lib/filesystem";
import {
    projectSymbols,
    searchProject,
    type ProjectSymbol,
    type SearchMatch,
} from "../../../lib/project";
import { Command } from "./commands";

const MAX_RESULTS = 50;
const ALL_CAP = 8; // per-category cap in the merged "all" scope

export type Scope = "all" | "files" | "symbols" | "actions" | "text";
export const SCOPES: Scope[] = ["all", "files", "symbols", "actions", "text"];

const score = (file: ProjectFile, q: string): number => {
    const name = file.name.toLowerCase();
    const rel = file.relativePath.toLowerCase();
    if (name.startsWith(q)) return 100;
    if (name.includes(q)) return 60;
    if (rel.includes(q)) return 30;
    return 0;
};

export type PaletteItem =
    | { kind: "file"; file: ProjectFile }
    | { kind: "command"; command: Command }
    | { kind: "symbol"; symbol: ProjectSymbol }
    | { kind: "text"; match: SearchMatch };

// Search Everywhere: one palette over files + symbols + actions + text. The
// active scope (a tab) decides what shows; "all" merges a slice of each. The
// ">" / "#" prefixes still hard-jump to actions / symbols for muscle memory.
export function usePalette(
    path: string,
    commands: Command[],
    initialScope: Scope = "all"
) {
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [symbols, setSymbols] = useState<ProjectSymbol[]>([]);
    const [texts, setTexts] = useState<SearchMatch[]>([]);
    const [query, setQuery] = useState("");
    const [scope, setScope] = useState<Scope>(initialScope);
    const [active, setActive] = useState(0);

    useEffect(() => {
        walkProjectFiles(path).then(setFiles);
    }, [path]);

    const trimmed = query.trimStart();
    const prefixScope: Scope | null = trimmed.startsWith(">")
        ? "actions"
        : trimmed.startsWith("#")
          ? "symbols"
          : null;
    const effScope = prefixScope ?? scope;
    const q = (prefixScope ? trimmed.slice(1) : query).trim();
    const ql = q.toLowerCase();

    const wantSymbols = effScope === "symbols" || (effScope === "all" && !!q);
    useEffect(() => {
        if (!wantSymbols) {
            setSymbols([]);
            return;
        }
        const timer = setTimeout(() => {
            projectSymbols(q)
                .then((s) => setSymbols(s.slice(0, MAX_RESULTS)))
                .catch(() => setSymbols([]));
        }, 150);
        return () => clearTimeout(timer);
    }, [wantSymbols, q]);

    const wantText = !!q && (effScope === "text" || effScope === "all");
    useEffect(() => {
        if (!wantText) {
            setTexts([]);
            return;
        }
        const timer = setTimeout(() => {
            searchProject(q, false)
                .then((r) => setTexts((r?.matches ?? []).slice(0, MAX_RESULTS)))
                .catch(() => setTexts([]));
        }, 200);
        return () => clearTimeout(timer);
    }, [wantText, q]);

    const fileItems = useMemo<PaletteItem[]>(() => {
        const list = !ql
            ? files.slice(0, MAX_RESULTS)
            : files
                  .map((file) => ({ file, s: score(file, ql) }))
                  .filter((x) => x.s > 0)
                  .sort((a, b) => b.s - a.s)
                  .slice(0, MAX_RESULTS)
                  .map((x) => x.file);
        return list.map((file) => ({ kind: "file", file }));
    }, [files, ql]);

    const commandItems = useMemo<PaletteItem[]>(
        () =>
            commands
                .filter((c) => c.enabled !== false)
                .filter((c) => !ql || c.title.toLowerCase().includes(ql))
                .map((command) => ({ kind: "command", command })),
        [commands, ql]
    );

    const items = useMemo<PaletteItem[]>(() => {
        const syms: PaletteItem[] = symbols.map((symbol) => ({ kind: "symbol", symbol }));
        const txts: PaletteItem[] = texts.map((match) => ({ kind: "text", match }));
        switch (effScope) {
            case "files":
                return fileItems;
            case "symbols":
                return syms;
            case "actions":
                return commandItems;
            case "text":
                return txts;
            default:
                return [
                    ...fileItems.slice(0, ALL_CAP),
                    ...syms.slice(0, ALL_CAP),
                    ...commandItems.slice(0, ALL_CAP),
                    ...txts.slice(0, ALL_CAP),
                ];
        }
    }, [effScope, fileItems, commandItems, symbols, texts]);

    useEffect(() => setActive(0), [items]);

    const moveActive = (delta: number) =>
        setActive((a) => Math.min(Math.max(a + delta, 0), items.length - 1));

    // Cycle / set the scope, dropping any prefix so the chosen tab takes effect.
    const selectScope = (s: Scope) => {
        setScope(s);
        if (prefixScope) setQuery(q);
    };
    const cycleScope = (delta: number) => {
        const i = SCOPES.indexOf(effScope);
        selectScope(SCOPES[(i + delta + SCOPES.length) % SCOPES.length]);
    };

    return {
        query,
        setQuery,
        effScope,
        selectScope,
        cycleScope,
        items,
        active,
        setActive,
        moveActive,
    };
}
