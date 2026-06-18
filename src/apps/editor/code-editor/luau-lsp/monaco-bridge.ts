import * as monaco from "monaco-editor";
import { LuauLspClient } from "./client";
import { toMarker } from "./convert";
import { registerProviders } from "./language-providers";

const LUAU_LANGUAGES = new Set(["lua", "luau"]);
const MARKER_OWNER = "luau-lsp";

// Wire the luau-lsp client into Monaco: stream diagnostics as markers, keep the
// server in sync with open models, and register the language feature providers.
export function registerLuauLsp(client: LuauLspClient): () => void {
    const disposables: monaco.IDisposable[] = [];

    client.onDiagnostics = (uri, diagnostics) => {
        const model = findModel(uri);
        if (model) {
            monaco.editor.setModelMarkers(model, MARKER_OWNER, diagnostics.map(toMarker));
        }
    };

    const track = (model: monaco.editor.ITextModel) => {
        if (!LUAU_LANGUAGES.has(model.getLanguageId())) return;
        const uri = model.uri.toString();
        client.didOpen(uri, model.getValue());
        disposables.push(
            model.onDidChangeContent(() => client.didChange(uri, model.getValue()))
        );
        disposables.push(model.onWillDispose(() => client.didClose(uri)));
    };

    monaco.editor.getModels().forEach(track);
    disposables.push(monaco.editor.onDidCreateModel(track));

    for (const language of LUAU_LANGUAGES) {
        disposables.push(...registerProviders(client, language));
    }

    return () => disposables.forEach((d) => d.dispose());
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
