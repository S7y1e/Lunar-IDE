import { useEffect } from "react";
import * as monaco from "monaco-editor";
import { RuntimeDiagnostic } from "./diagnostics";

const OWNER = "lunar-runtime";

const SEVERITY = {
    error: monaco.MarkerSeverity.Error,
    warning: monaco.MarkerSeverity.Warning,
    info: monaco.MarkerSeverity.Info,
};

// Paints runtime diagnostics as Monaco markers (squiggles + hover) on the source
// line. Markers live on a model, which only exists while the file is open, so we
// re-apply whenever a model is created (file opened after the error landed).
export function useRuntimeMarkers(diagnostics: RuntimeDiagnostic[]) {
    useEffect(() => {
        const byUri = new Map<string, RuntimeDiagnostic[]>();
        for (const diagnostic of diagnostics) {
            const list = byUri.get(diagnostic.uri) ?? [];
            list.push(diagnostic);
            byUri.set(diagnostic.uri, list);
        }

        const apply = () => {
            for (const model of monaco.editor.getModels()) {
                const list = byUri.get(model.uri.toString()) ?? [];
                const markers = list.map((diagnostic) => {
                    const line = Math.min(
                        Math.max(diagnostic.line, 1),
                        model.getLineCount()
                    );
                    return {
                        startLineNumber: line,
                        endLineNumber: line,
                        startColumn: 1,
                        endColumn: model.getLineMaxColumn(line),
                        message: diagnostic.message,
                        severity: SEVERITY[diagnostic.severity],
                    };
                });
                monaco.editor.setModelMarkers(model, OWNER, markers);
            }
        };

        apply();
        const sub = monaco.editor.onDidCreateModel(apply);
        return () => sub.dispose();
    }, [diagnostics]);
}
