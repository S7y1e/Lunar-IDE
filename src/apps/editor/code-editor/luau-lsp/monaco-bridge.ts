import * as monaco from "monaco-editor";
import { LuauLspClient } from "./client";
import {
    toLspPosition,
    toCompletionList,
    toCompletionItem,
    toHover,
    toMarker,
    toMonacoLocations,
    toDocumentSymbols,
    toWorkspaceEdit,
    toSignatureHelp,
} from "./convert";
import type { LspCompletionItem } from "./convert";

const LUAU_LANGUAGES = new Set(["lua", "luau"]);
const MARKER_OWNER = "luau-lsp";

export function registerLuauLsp(client: LuauLspClient): () => void {
    const disposables: monaco.IDisposable[] = [];

    client.onDiagnostics = (uri, diagnostics) => {
        const model = findModel(uri);
        if (model) {
            monaco.editor.setModelMarkers(
                model,
                MARKER_OWNER,
                diagnostics.map(toMarker)
            );
        }
    };

    const track = (model: monaco.editor.ITextModel) => {
        if (!LUAU_LANGUAGES.has(model.getLanguageId())) return;
        const uri = model.uri.toString();
        console.debug("[luau-lsp] open", uri);
        client.didOpen(uri, model.getValue());
        disposables.push(
            model.onDidChangeContent(() => client.didChange(uri, model.getValue()))
        );
        disposables.push(model.onWillDispose(() => client.didClose(uri)));
    };

    monaco.editor.getModels().forEach(track);
    disposables.push(monaco.editor.onDidCreateModel(track));

    for (const language of LUAU_LANGUAGES) {
        disposables.push(
            monaco.languages.registerCompletionItemProvider(language, {
                triggerCharacters: [".", ":", "'", '"', "/"],
                async provideCompletionItems(model, position) {
                    const result = await client.completion(
                        model.uri.toString(),
                        toLspPosition(position)
                    );
                    const list = toCompletionList(result, model, position);
                    console.debug("[luau-lsp] completion", list.suggestions.length);
                    return list;
                },
                async resolveCompletionItem(item) {
                    const lspItem = (item as monaco.languages.CompletionItem & { data?: LspCompletionItem }).data;
                    if (!lspItem) return item;
                    try {
                        const resolved = await client.completionResolve(lspItem);
                        if (!resolved.additionalTextEdits?.length) return item;
                        return toCompletionItem(resolved, item.range as monaco.IRange);
                    } catch {
                        return item;
                    }
                },
            })
        );

        disposables.push(
            monaco.languages.registerHoverProvider(language, {
                async provideHover(model, position) {
                    const result = await client.hover(
                        model.uri.toString(),
                        toLspPosition(position)
                    );
                    return toHover(result);
                },
            })
        );

        disposables.push(
            monaco.languages.registerDefinitionProvider(language, {
                async provideDefinition(model, position) {
                    const result = await client.definition(
                        model.uri.toString(),
                        toLspPosition(position)
                    );
                    return toMonacoLocations(result);
                },
            })
        );

        disposables.push(
            monaco.languages.registerReferenceProvider(language, {
                async provideReferences(model, position) {
                    const result = await client.references(
                        model.uri.toString(),
                        toLspPosition(position)
                    );
                    return toMonacoLocations(result);
                },
            })
        );

        disposables.push(
            monaco.languages.registerDocumentSymbolProvider(language, {
                async provideDocumentSymbols(model) {
                    const result = await client.documentSymbols(
                        model.uri.toString()
                    );
                    return toDocumentSymbols(result);
                },
            })
        );

        disposables.push(
            monaco.languages.registerRenameProvider(language, {
                async provideRenameEdits(model, position, newName) {
                    const result = await client.rename(
                        model.uri.toString(),
                        toLspPosition(position),
                        newName
                    );
                    return toWorkspaceEdit(result);
                },
            })
        );

        disposables.push(
            monaco.languages.registerSignatureHelpProvider(language, {
                signatureHelpTriggerCharacters: ["(", ","],
                async provideSignatureHelp(model, position) {
                    const result = await client.signatureHelp(
                        model.uri.toString(),
                        toLspPosition(position)
                    );
                    return toSignatureHelp(result);
                },
            })
        );

        disposables.push(
            monaco.languages.registerDocumentSemanticTokensProvider(language, {
                getLegend() {
                    return (
                        client.semanticTokensLegend() ?? {
                            tokenTypes: [],
                            tokenModifiers: [],
                        }
                    );
                },
                async provideDocumentSemanticTokens(model) {
                    const result = await client.semanticTokensFull(
                        model.uri.toString()
                    );
                    if (!result?.data) return null;
                    return { data: sanitizeSemanticTokens(result.data, model) };
                },
                releaseDocumentSemanticTokens() {},
            })
        );
    }

    return () => disposables.forEach((d) => d.dispose());
}

// The server may return a token whose position lies past the current model
// (a version race: tokens were computed for a slightly newer/older document).
// Monaco rejects the *entire* batch on a single out-of-bounds token, which
// makes all semantic highlighting vanish until the file is reopened. Walk the
// LSP delta-encoded stream, drop/clamp any token that doesn't fit the model,
// and re-encode the survivors so the rest still highlight.
function sanitizeSemanticTokens(
    data: number[],
    model: monaco.editor.ITextModel
): Uint32Array {
    const out: number[] = [];
    const lineCount = model.getLineCount();
    // Absolute position while decoding the input stream.
    let absLine = 0;
    let absChar = 0;
    // Absolute position of the last token we kept, for re-encoding deltas.
    let lastLine = 0;
    let lastChar = 0;

    for (let i = 0; i + 4 < data.length; i += 5) {
        const dLine = data[i];
        const dStart = data[i + 1];
        const len = data[i + 2];
        const type = data[i + 3];
        const mods = data[i + 4];

        if (dLine === 0) {
            absChar += dStart;
        } else {
            absLine += dLine;
            absChar = dStart;
        }

        // Token lines are 0-indexed; Monaco lines are 1-indexed.
        const mLine = absLine + 1;
        if (mLine < 1 || mLine > lineCount) continue;

        const lineLen = model.getLineLength(mLine);
        if (absChar > lineLen) continue;
        const safeLen = Math.min(len, lineLen - absChar);
        if (safeLen <= 0) continue;

        const eDLine = absLine - lastLine;
        const eDStart = eDLine === 0 ? absChar - lastChar : absChar;
        out.push(eDLine, eDStart, safeLen, type, mods);
        lastLine = absLine;
        lastChar = absChar;
    }

    return new Uint32Array(out);
}

function findModel(uri: string): monaco.editor.ITextModel | null {
    const direct = monaco.editor.getModel(monaco.Uri.parse(uri));
    if (direct) return direct;
    const target = normalize(uri);
    return (
        monaco.editor
            .getModels()
            .find((model) => normalize(model.uri.toString()) === target) ?? null
    );
}

function normalize(uri: string): string {
    try {
        return decodeURIComponent(uri).toLowerCase();
    } catch {
        return uri.toLowerCase();
    }
}
