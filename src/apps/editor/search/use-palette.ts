import { useEffect, useMemo, useState } from "react";
import { ProjectFile, walkProjectFiles } from "../../../lib/filesystem";
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
    | { kind: "command"; command: Command };

// A leading ">" switches the palette from file search to command (actions) mode.
export function usePalette(path: string, commands: Command[], initialQuery = "") {
    const [files, setFiles] = useState<ProjectFile[]>([]);
    const [query, setQuery] = useState(initialQuery);
    const [active, setActive] = useState(0);

    useEffect(() => {
        walkProjectFiles(path).then(setFiles);
    }, [path]);

    const isCommand = query.trimStart().startsWith(">");

    const items = useMemo<PaletteItem[]>(() => {
        if (isCommand) {
            const q = query.trimStart().slice(1).trim().toLowerCase();
            return commands
                .filter((c) => c.enabled !== false)
                .filter((c) => !q || c.title.toLowerCase().includes(q))
                .map((command) => ({ kind: "command", command }));
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
    }, [isCommand, query, files, commands]);

    useEffect(() => setActive(0), [query]);

    const moveActive = (delta: number) =>
        setActive((a) => Math.min(Math.max(a + delta, 0), items.length - 1));

    return { query, setQuery, isCommand, items, active, setActive, moveActive };
}
