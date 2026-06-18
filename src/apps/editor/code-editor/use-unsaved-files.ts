import { useCallback, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { pathToUri } from "./luau-lsp/uri";

// Tracks which open files have unsaved edits and saves only those. Writing every
// open model is dangerous: a model that failed to load holds "" and would wipe
// the file. Dirty-only mirrors VS Code and makes accidental data loss impossible.
export function useUnsavedFiles() {
    const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());

    const handleDirtyChange = useCallback((filePath: string, dirty: boolean) => {
        setDirtyFiles((prev) => {
            const hasDirty = prev.has(filePath);
            if (dirty === hasDirty) return prev;
            const next = new Set(prev);
            if (dirty) next.add(filePath);
            else next.delete(filePath);
            return next;
        });
    }, []);

    const dirtyFilesRef = useRef(dirtyFiles);
    dirtyFilesRef.current = dirtyFiles;

    const saveAll = useCallback(async () => {
        await Promise.all(
            [...dirtyFilesRef.current].map(async (filePath) => {
                const model = monaco.editor.getModel(
                    monaco.Uri.parse(pathToUri(filePath)),
                );
                if (!model) return;
                try {
                    await writeTextFile(filePath, model.getValue());
                } catch (e) {
                    // Don't let one failed write abort saving the others.
                    console.error("failed to save", filePath, e);
                }
            }),
        );
    }, []);

    return { dirtyFiles, handleDirtyChange, saveAll };
}
