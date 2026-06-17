import { useEffect, useState } from "react";
import * as monaco from "monaco-editor";
import { getCurrentLspClient } from "../code-editor/luau-lsp/lsp-registry";
import { pathToUri } from "../code-editor/luau-lsp/uri";
import type { LspDocumentSymbol } from "../code-editor/luau-lsp/convert";

// The active file's document symbols (functions/fields/…), kept live by
// re-querying the LSP when the editor content changes.
export function useStructure(activeFile: string | null): LspDocumentSymbol[] {
    const [symbols, setSymbols] = useState<LspDocumentSymbol[]>([]);

    useEffect(() => {
        if (!activeFile) {
            setSymbols([]);
            return;
        }
        const uri = pathToUri(activeFile);
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const fetch = () => {
            const client = getCurrentLspClient();
            if (!client) return;
            client
                .documentSymbols(uri)
                .then((s) => alive && setSymbols(s ?? []))
                .catch(() => {});
        };

        fetch();
        // Late start: the LSP/model may not be ready on the first tick.
        const retry = setTimeout(fetch, 600);

        const model = monaco.editor.getModel(monaco.Uri.parse(uri));
        const sub = model?.onDidChangeContent(() => {
            clearTimeout(timer);
            timer = setTimeout(fetch, 400);
        });

        return () => {
            alive = false;
            clearTimeout(timer);
            clearTimeout(retry);
            sub?.dispose();
        };
    }, [activeFile]);

    return symbols;
}
