// Shapes of the LSP payloads luau-lsp returns, decoded into Monaco by the
// `convert*` modules.
export type LspPosition = { line: number; character: number };
export type LspRange = { start: LspPosition; end: LspPosition };

export type LspDiagnostic = {
    range: LspRange;
    severity?: number;
    message: string;
    source?: string;
};

export type LspDocumentation = string | { kind?: string; value: string } | undefined;

export type LspTextEdit = {
    range: LspRange;
    newText: string;
};

export type LspCompletionItem = {
    label: string;
    kind?: number;
    detail?: string;
    documentation?: LspDocumentation;
    insertText?: string;
    insertTextFormat?: number;
    sortText?: string;
    filterText?: string;
    additionalTextEdits?: LspTextEdit[];
    data?: unknown;
};

export type LspCompletionResult =
    | LspCompletionItem[]
    | { items: LspCompletionItem[] }
    | null;

export type LspMarkup = string | { language?: string; kind?: string; value: string };

export type LspHover = {
    contents: LspMarkup | LspMarkup[];
    range?: LspRange;
} | null;

export type LspLocation = { uri: string; range: LspRange };
// definition/references can return a single Location, a list, or null.
export type LspLocationResult = LspLocation | LspLocation[] | null;

export type LspDocumentSymbol = {
    name: string;
    detail?: string;
    kind: number;
    range: LspRange;
    selectionRange: LspRange;
    children?: LspDocumentSymbol[];
};

export type LspWorkspaceEdit = {
    changes?: { [uri: string]: LspTextEdit[] };
    documentChanges?: { textDocument: { uri: string }; edits: LspTextEdit[] }[];
} | null;

export type LspParameter = { label: string | [number, number]; documentation?: LspDocumentation };
export type LspSignature = {
    label: string;
    documentation?: LspDocumentation;
    parameters?: LspParameter[];
};
export type LspSignatureHelp = {
    signatures: LspSignature[];
    activeSignature?: number;
    activeParameter?: number;
} | null;
