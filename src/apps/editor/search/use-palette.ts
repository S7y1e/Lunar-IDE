import { useEffect, useMemo, useState } from "react";
import { ProjectFile, walkProjectFiles } from "../../../lib/filesystem";
import { projectSymbols, type ProjectSymbol } from "../../../lib/project";
import { Command } from "./commands";

const MAX_RESULTS = 50;

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
    | { kind: "symbol"; symbol: ProjectSymbol };

// Palette modes by prefix: ">" = commands (actions), "#" = project symbols,
// otherwise file search.
export function usePalette(path: string, commands: Command[], initialQuery = "") {
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [symbols, setSymbols] = useState<ProjectSymbol[]>([]);
    const [query, setQuery] = useState(initialQuery);
    const [active, setActive] = useState(0);

    useEffect(() => {
        walkProjectFiles(path).then(setFiles);
    }, [path]);

    const trimmed = query.trimStart();
    const isCommand = trimmed.startsWith(">");
    const isSymbol = trimmed.startsWith("#");

    useEffect(() => {
        if (!isSymbol) {
            setSymbols([]);
            return;
        }
        const q = trimmed.slice(1).trim();
        const timer = setTimeout(() => {
            projectSymbols(q)
                .then((s) => setSymbols(s.slice(0, MAX_RESULTS)))
                .catch(() => setSymbols([]));
        }, 150);
        return () => clearTimeout(timer);
    }, [isSymbol, trimmed]);

    const items = useMemo<PaletteItem[]>(() => {
        if (isCommand) {
            const q = trimmed.slice(1).trim().toLowerCase();
            return commands
                .filter((c) => c.enabled !== false)
                .filter((c) => !q || c.title.toLowerCase().includes(q))
                .map((command) => ({ kind: "command", command }));
        }
        if (isSymbol) {
            return symbols.map((symbol) => ({ kind: "symbol", symbol }));
        }
        const q = query.trim().toLowerCase();
        const list = !q
            ? files.slice(0, MAX_RESULTS)
            : files
                  .map((file) => ({ file, s: score(file, q) }))
                  .filter((x) => x.s > 0)
                  .sort((a, b) => b.s - a.s)
                  .slice(0, MAX_RESULTS)
                  .map((x) => x.file);
        return list.map((file) => ({ kind: "file", file }));
    }, [isCommand, isSymbol, query, trimmed, files, commands, symbols]);

    useEffect(() => setActive(0), [query, symbols]);

    const moveActive = (delta: number) =>
        setActive((a) => Math.min(Math.max(a + delta, 0), items.length - 1));

    return { query, setQuery, isCommand, isSymbol, items, active, setActive, moveActive };
}
