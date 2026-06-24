import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import { registerLuauLanguage } from "./luau-language";
import { registerUiAutocomplete } from "./ui-autocomplete/provider";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
    getWorker(_moduleId, label) {
        switch (label) {
            case "json":
                return new jsonWorker();
            case "css":
            case "scss":
            case "less":
                return new cssWorker();
            case "html":
            case "handlebars":
            case "razor":
                return new htmlWorker();
            case "typescript":
            case "javascript":
                return new tsWorker();
            default:
                return new editorWorker();
        }
    },
};

loader.config({ monaco });

registerLuauLanguage();
registerUiAutocomplete();

const SCROLLBAR = {
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#ffffff1f",
    "scrollbarSlider.hoverBackground": "#ffffff38",
    "scrollbarSlider.activeBackground": "#ffffff4a",
};

// Nord (default)
monaco.editor.defineTheme("lunar-nord", {
    base: "vs-dark",
    inherit: true,
    rules: [
        { token: "", foreground: "d8dee9" },
        { token: "comment", foreground: "616e88", fontStyle: "italic" },
        { token: "keyword", foreground: "81a1c1" },
        { token: "keyword.control", foreground: "81a1c1" },
        { token: "string", foreground: "a3be8c" },
        { token: "string.escape", foreground: "ebcb8b" },
        { token: "number", foreground: "b48ead" },
        { token: "constant", foreground: "b48ead" },
        { token: "constant.language", foreground: "81a1c1" },
        { token: "type", foreground: "8fbcbb" },
        { token: "type.identifier", foreground: "8fbcbb" },
        { token: "function", foreground: "88c0d0" },
        { token: "identifier", foreground: "d8dee9" },
        { token: "variable", foreground: "d8dee9" },
        { token: "variable.predefined", foreground: "8fbcbb" },
        { token: "delimiter", foreground: "eceff4" },
        { token: "operator", foreground: "81a1c1" },
        // Semantic token types (from luau-lsp)
        { token: "function", foreground: "88c0d0" },
        { token: "method", foreground: "88c0d0" },
        { token: "macro", foreground: "88c0d0" },
        { token: "property", foreground: "d8dee9" },
        { token: "parameter", foreground: "d8dee9" },
        { token: "class", foreground: "8fbcbb" },
        { token: "interface", foreground: "8fbcbb" },
        { token: "struct", foreground: "8fbcbb" },
        { token: "enum", foreground: "8fbcbb" },
        { token: "typeParameter", foreground: "8fbcbb" },
        { token: "namespace", foreground: "8fbcbb" },
        { token: "enumMember", foreground: "b48ead" },
        { token: "decorator", foreground: "d08770" },
    ],
    colors: {
        "editor.background": "#2e3440",
        "editor.foreground": "#d8dee9",
        "editorLineNumber.foreground": "#4c566a",
        "editorLineNumber.activeForeground": "#d8dee9",
        "editor.lineHighlightBackground": "#3b4252",
        "editor.lineHighlightBorder": "#00000000",
        "editorCursor.foreground": "#d8dee9",
        "editor.selectionBackground": "#434c5e",
        "editorIndentGuide.background": "#3b4252",
        "editorIndentGuide.activeBackground": "#4c566a",
        "editorIndentGuide.background1": "#3b4252",
        "editorIndentGuide.activeBackground1": "#4c566a",
        "editorRuler.foreground": "#3b4252",
        "editorGutter.background": "#2e3440",
        ...SCROLLBAR,
    },
});

// Dracula
monaco.editor.defineTheme("lunar-dracula", {
    base: "vs-dark",
    inherit: true,
    rules: [
        { token: "", foreground: "f8f8f2" },
        { token: "comment", foreground: "6272a4", fontStyle: "italic" },
        { token: "keyword", foreground: "ff79c6" },
        { token: "keyword.control", foreground: "ff79c6" },
        { token: "string", foreground: "f1fa8c" },
        { token: "string.escape", foreground: "ff79c6" },
        { token: "number", foreground: "bd93f9" },
        { token: "constant", foreground: "bd93f9" },
        { token: "constant.language", foreground: "bd93f9" },
        { token: "type", foreground: "8be9fd" },
        { token: "type.identifier", foreground: "8be9fd" },
        { token: "function", foreground: "50fa7b" },
        { token: "identifier", foreground: "f8f8f2" },
        { token: "variable", foreground: "f8f8f2" },
        { token: "variable.predefined", foreground: "bd93f9" },
        { token: "delimiter", foreground: "f8f8f2" },
        { token: "operator", foreground: "ff79c6" },
        // Semantic token types (from luau-lsp)
        { token: "function", foreground: "50fa7b" },
        { token: "method", foreground: "50fa7b" },
        { token: "macro", foreground: "50fa7b" },
        { token: "property", foreground: "f8f8f2" },
        { token: "parameter", foreground: "ffb86c", fontStyle: "italic" },
        { token: "class", foreground: "8be9fd" },
        { token: "interface", foreground: "8be9fd" },
        { token: "struct", foreground: "8be9fd" },
        { token: "enum", foreground: "8be9fd" },
        { token: "typeParameter", foreground: "8be9fd" },
        { token: "namespace", foreground: "8be9fd" },
        { token: "enumMember", foreground: "bd93f9" },
        { token: "decorator", foreground: "50fa7b" },
    ],
    colors: {
        "editor.background": "#282a36",
        "editor.foreground": "#f8f8f2",
        "editorLineNumber.foreground": "#6272a4",
        "editorLineNumber.activeForeground": "#f8f8f2",
        "editor.lineHighlightBackground": "#343746",
        "editor.lineHighlightBorder": "#00000000",
        "editorCursor.foreground": "#f8f8f2",
        "editor.selectionBackground": "#44475a",
        "editorIndentGuide.background": "#343746",
        "editorIndentGuide.activeBackground": "#6272a4",
        "editorIndentGuide.background1": "#343746",
        "editorIndentGuide.activeBackground1": "#6272a4",
        "editorRuler.foreground": "#343746",
        "editorGutter.background": "#282a36",
        ...SCROLLBAR,
    },
});
