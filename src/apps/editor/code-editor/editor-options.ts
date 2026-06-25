import type * as monaco from "monaco-editor";

export const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: false },
    "semanticHighlighting.enabled": true,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    fontLigatures: true,
    mouseWheelZoom: true,
    // Auto-trigger completion inside strings so library class-name completion
    // (e.g. Fusion `New "Text…"`) pops without Ctrl+Space.
    quickSuggestions: { other: true, comments: false, strings: true },
    lineHeight: 20,
    letterSpacing: 0,
    smoothScrolling: true,
    lineNumbersMinChars: 4,
    lineDecorationsWidth: 25,
    glyphMargin: true,
    scrollBeyondLastLine: false,
    padding: { top: 6 },
    scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        useShadows: false,
    },
    guides: {
        indentation: true,
        highlightActiveIndentation: true,
        bracketPairs: false,
    },
    rulers: [0],
};
