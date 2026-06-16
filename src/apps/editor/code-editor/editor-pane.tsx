import { useEffect, useRef, useState } from "react";
import { Editor as MonacoEditor } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import "./monaco-setup";
import "@fontsource/jetbrains-mono/index.css";
import styles from "./code-editor.module.scss";
import { languageFor } from "./editor-language";
import { EDITOR_OPTIONS } from "./editor-options";
import { useFileContent } from "./use-file-content";
import { pathToUri } from "./luau-lsp/uri";
import { registerAutocompleteEnd } from "./luau-lsp/autocomplete-end";
import {
    readSettings,
    subscribeSettings,
    SettingsValues,
} from "../../../lib/settings";
import { MONACO_THEME, getTheme, subscribeTheme } from "../../../lib/theme";

type CursorPosition = { line: number; column: number };

// User editor settings applied on top of EDITOR_OPTIONS, live.
function applyEditorSettings(
    editor: monaco.editor.IStandaloneCodeEditor,
    values: SettingsValues
) {
    const get = <T,>(key: string, fallback: T): T =>
        key in values ? (values[key] as T) : fallback;
    editor.updateOptions({
        fontSize: Number(get("lunar.editor.fontSize", 13)),
        fontFamily: get("lunar.editor.fontFamily", "'JetBrains Mono', monospace"),
        fontLigatures: get("lunar.editor.fontLigatures", true),
        wordWrap: get<"on" | "off">("lunar.editor.wordWrap", "off"),
        lineNumbers: get<monaco.editor.LineNumbersType>(
            "lunar.editor.lineNumbers",
            "on"
        ),
        minimap: { enabled: get("lunar.editor.minimap", false) },
        stickyScroll: { enabled: get("lunar.editor.stickyScroll", false) },
        renderWhitespace: get<"none" | "boundary" | "selection" | "trailing" | "all">(
            "lunar.editor.renderWhitespace",
            "selection"
        ),
    });
    editor.getModel()?.updateOptions({
        tabSize: Number(get("lunar.editor.tabSize", 4)),
        insertSpaces: true,
    });
}

type Props = {
    path: string | null;
    onDirtyChange: (path: string, dirty: boolean) => void;
    onCursorChange: (pos: CursorPosition | null) => void;
    onReady?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
};

export default function EditorPane({
    path,
    onDirtyChange,
    onCursorChange,
    onReady,
}: Props) {
    const {
        content,
        setContent,
        save,
        saveError,
        isDirty,
        externalChange,
        reloadFromDisk,
        keepMine,
    } = useFileContent(path);
    const [theme, setTheme] = useState(getTheme());
    useEffect(() => subscribeTheme(setTheme), []);
    const autocompleteEndEnabled = useRef(false);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const onDirtyRef = useRef(onDirtyChange);
    onDirtyRef.current = onDirtyChange;
    const onCursorRef = useRef(onCursorChange);
    onCursorRef.current = onCursorChange;
    // The Monaco save action is registered once on mount, so it must read the
    // *current* save through a ref. Otherwise it keeps calling the save bound to
    // the first file ever opened and writes every Ctrl+S into that file.
    const saveRef = useRef(save);
    saveRef.current = save;

    // Single source of truth for the dirty indicator: buffer vs. what's on disk.
    // This also self-corrects when the file is reloaded after an external
    // (Argon) write, since isDirty goes back to false.
    useEffect(() => {
        if (path) onDirtyRef.current(path, isDirty);
    }, [path, isDirty]);

    // With no file open there's no cursor; clear the status bar position.
    useEffect(() => {
        if (!path) onCursorRef.current(null);
    }, [path]);

    // Re-apply editor settings live when they change.
    useEffect(
        () =>
            subscribeSettings((values) => {
                if (editorRef.current) applyEditorSettings(editorRef.current, values);
            }),
        []
    );

    function handleMount(editor: monaco.editor.IStandaloneCodeEditor) {
        onReady?.(editor);
        editorRef.current = editor;
        readSettings().then((values) => {
            autocompleteEndEnabled.current =
                values["luau-lsp.completion.autocompleteEnd"] === true;
            applyEditorSettings(editor, values);
        });

        registerAutocompleteEnd(editor, () => autocompleteEndEnabled.current);

        const reportCursor = (pos: monaco.Position | null) =>
            onCursorRef.current(
                pos ? { line: pos.lineNumber, column: pos.column } : null,
            );
        reportCursor(editor.getPosition());
        editor.onDidChangeCursorPosition((e) => reportCursor(e.position));

        editor.addAction({
            id: "lunar.saveFile",
            label: "Save File",
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
            run: () => {
                saveRef.current().catch((e) => console.error("save failed", e));
            },
        });

        // VS Code-style editor zoom. mouseWheelZoom (in EDITOR_OPTIONS) already
        // gives Ctrl+scroll; these bind the keyboard shortcuts to the same
        // global font-zoom level so keys and wheel stay in sync.
        const zoom = (action: string) => editor.getAction(action)?.run();
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal, () =>
            zoom("editor.action.fontZoomIn"),
        );
        editor.addCommand(
            monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Equal,
            () => zoom("editor.action.fontZoomIn"),
        );
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus, () =>
            zoom("editor.action.fontZoomOut"),
        );
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit0, () =>
            zoom("editor.action.fontZoomReset"),
        );
    }

    function handleChange(value: string) {
        if (!path) return;
        setContent(value);
    }

    if (!path) {
        return <div className={styles.empty}>Open a file to start editing</div>;
    }

    const name = path.split(/[\\/]/).pop() ?? path;

    return (
        <div className={styles.paneRoot}>
            {saveError && (
                <div className={styles.saveErrorBanner}>
                    Save failed: {saveError}
                </div>
            )}
            {externalChange && (
                <div className={styles.conflictBanner}>
                    <span className={styles.conflictText}>
                        This file changed on disk
                        {isDirty ? " (you have unsaved edits)" : ""}.
                    </span>
                    <div className={styles.conflictActions}>
                        <button
                            className={styles.conflictReload}
                            onClick={reloadFromDisk}
                        >
                            Reload
                        </button>
                        <button
                            className={styles.conflictKeep}
                            onClick={keepMine}
                        >
                            Keep mine
                        </button>
                    </div>
                </div>
            )}
            <div className={styles.paneEditor}>
                <MonacoEditor
                    path={pathToUri(path)}
                    value={content}
                    language={languageFor(name)}
                    theme={MONACO_THEME[theme]}
                    onChange={(value) => handleChange(value ?? "")}
                    options={EDITOR_OPTIONS}
                    onMount={handleMount}
                />
            </div>
        </div>
    );
}
