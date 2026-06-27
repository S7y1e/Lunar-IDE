import { useCallback, useEffect, useState, type RefObject } from "react";
import { join } from "@tauri-apps/api/path";
import * as monaco from "monaco-editor";
import { pathToUri, uriToPath, canonicalPath } from "./luau-lsp/uri";
import { toRelative } from "../data-model/instance-path";
import { type CallTarget } from "../callhierarchy/call-hierarchy-panel";
import { type UsageTarget } from "../usages/usages-panel";
import { type ToolId } from "../layout/layout-types";
import { useToasts } from "../notifications/use-toasts";

type Deps = {
    path: string;
    activeFile: string | null;
    resolve: (dotPath: string) => string | null;
    openFile: (abs: string) => void;
    editorRef: RefObject<monaco.editor.IStandaloneCodeEditor | null>;
    showView: (id: ToolId) => void;
    toasts: ReturnType<typeof useToasts>;
};

export function useEditorNavigation({
    path,
    activeFile,
    resolve,
    openFile,
    editorRef,
    showView,
    toasts,
}: Deps) {
    const [callTarget, setCallTarget] = useState<CallTarget | null>(null);
    const [usageTarget, setUsageTarget] = useState<UsageTarget | null>(null);

    // Reveal a line once Monaco has swapped to the target model — right after
    // openFile the model may not be loaded yet, so poll a few frames.
    const revealLine = useCallback((uri: string, line: number, column = 1) => {
        const reveal = (attempt: number) => {
            const editor = editorRef.current;
            if (editor?.getModel()?.uri.toString() === uri) {
                editor.revealLineInCenter(line);
                editor.setPosition({ lineNumber: line, column });
                editor.focus();
            } else if (attempt < 60) {
                requestAnimationFrame(() => reveal(attempt + 1));
            }
        };
        reveal(0);
    }, []);

    // Jump the active editor to a line/column (used by the Structure outline).
    const goToLine = useCallback((line: number, column: number) => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column });
        editor.focus();
    }, []);

    // Remap a Studio stack location (instance path + line) to the owned source.
    const openLocation = useCallback(
        async (dotPath: string, line: number) => {
            const source = resolve(dotPath);
            if (!source) return;
            const abs = canonicalPath(await join(path, ...source.split("/")));
            openFile(abs);
            revealLine(pathToUri(abs), line);
        },
        [resolve, path, openFile, revealLine],
    );

    // Open a project-search hit (relative path + line/column) and jump to it.
    const openFileAt = useCallback(
        async (relFile: string, line: number, column: number) => {
            const abs = canonicalPath(await join(path, ...relFile.split("/")));
            openFile(abs);
            revealLine(pathToUri(abs), line, column);
        },
        [path, openFile, revealLine],
    );

    // Open Call Hierarchy for the function name at the editor cursor.
    const showCallHierarchy = useCallback(() => {
        const editor = editorRef.current;
        const model = editor?.getModel();
        const pos = editor?.getPosition();
        const word = model && pos ? model.getWordAtPosition(pos)?.word : null;
        if (!word) {
            toasts.push("error", "Put the cursor on a function first");
            return;
        }
        setCallTarget({ name: word });
        showView("callhierarchy");
    }, [showView, toasts]);

    // Find Usages of the module member at the cursor (precise, cross-module).
    const showFindUsages = useCallback(() => {
        const editor = editorRef.current;
        const model = editor?.getModel();
        const pos = editor?.getPosition();
        const w = model && pos ? model.getWordAtPosition(pos) : null;
        if (!model || !pos || !w || !activeFile) {
            toasts.push("error", "Put the cursor on a member first");
            return;
        }
        const before = model.getLineContent(pos.lineNumber).slice(0, w.startColumn - 1);
        const receiver = before.match(/([A-Za-z_]\w*)\s*[.:]\s*$/)?.[1] ?? "";
        setUsageTarget({ fromFile: toRelative(path, activeFile), receiver, member: w.word });
        showView("usages");
    }, [path, activeFile, showView, toasts]);

    // Find which modules require the active module (reverse dependency edges).
    const showRequirers = useCallback(() => {
        if (!activeFile) {
            toasts.push("error", "Open a module first");
            return;
        }
        setUsageTarget({ kind: "requirers", file: toRelative(path, activeFile) });
        showView("usages");
    }, [path, activeFile, showView, toasts]);

    // Cross-file navigation for LSP go-to-definition / find-references: the
    // standalone Monaco can't open another file, so route its open requests
    // through Lunar's own openFile + reveal.
    useEffect(() => {
        const opener = monaco.editor.registerEditorOpener({
            openCodeEditor(_source, resource, selectionOrPosition) {
                const file = canonicalPath(uriToPath(resource.toString()));
                openFile(file);
                const line =
                    selectionOrPosition && "lineNumber" in selectionOrPosition
                        ? selectionOrPosition.lineNumber
                        : selectionOrPosition?.startLineNumber ?? 1;
                const column =
                    selectionOrPosition && "column" in selectionOrPosition
                        ? selectionOrPosition.column
                        : selectionOrPosition?.startColumn ?? 1;
                revealLine(pathToUri(file), line, column);
                return true;
            },
        });
        return () => opener.dispose();
    }, [openFile, revealLine]);

    return {
        callTarget,
        usageTarget,
        revealLine,
        goToLine,
        openLocation,
        openFileAt,
        showCallHierarchy,
        showFindUsages,
        showRequirers,
    };
}
