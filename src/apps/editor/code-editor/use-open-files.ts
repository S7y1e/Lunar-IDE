import { useState } from "react";
import { canonicalPath } from "./luau-lsp/uri";

export function useOpenFiles() {
    const [openFiles, setOpenFiles] = useState<string[]>([]);
    const [activeFile, setActiveFile] = useState<string | null>(null);

    const openFile = (rawPath: string) => {
        const path = canonicalPath(rawPath);
        setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
        setActiveFile(path);
    };

    const closeFile = (path: string) => {
        const index = openFiles.indexOf(path);
        const remaining = openFiles.filter((p) => p !== path);
        setOpenFiles(remaining);
        if (activeFile === path) {
            setActiveFile(remaining[index] ?? remaining[index - 1] ?? null);
        }
    };

    // Follow a disk rename: rewrite the path of the renamed file (or every open
    // file under a renamed folder) in place, keeping tab order and the active
    // tab. Without this a rename leaves a tab pointing at the old, gone path.
    const renameFile = (oldPath: string, newPath: string) => {
        const remap = (p: string) =>
            p === oldPath
                ? newPath
                : p.startsWith(oldPath + "\\") || p.startsWith(oldPath + "/")
                  ? newPath + p.slice(oldPath.length)
                  : p;
        setOpenFiles((prev) => prev.map(remap));
        setActiveFile((prev) => (prev ? remap(prev) : prev));
    };

    const reorderFiles = (from: number, to: number) => {
        setOpenFiles((prev) => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
        });
    };

    return {
        openFiles,
        activeFile,
        setActiveFile,
        openFile,
        closeFile,
        renameFile,
        reorderFiles,
    };
}
