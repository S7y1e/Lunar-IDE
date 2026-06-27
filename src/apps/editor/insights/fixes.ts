import * as monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import type { InsightFinding } from "../../../lib/project";

export type Fix = { label: string; kind: "delete-file" | "delete-line" };

export function fixFor(category: string): Fix | null {
    if (category === "orphan") return { label: "Delete file", kind: "delete-file" };
    if (category === "unused-require")
        return { label: "Remove unused require", kind: "delete-line" };
    return null;
}

// Disk-level fix (used by the Insights panel). The fs watcher refreshes insights.
export function applyDiskFix(f: InsightFinding): Promise<void> {
    const fix = fixFor(f.category);
    if (!fix) return Promise.resolve();
    return invoke("project_fix", { kind: fix.kind, file: f.file, line: f.line });
}

// Per-file store of line-deletable findings, for the editor quick-fix lightbulb.
const byFile = new Map<string, InsightFinding[]>();

export function setFileFixes(rel: string | null, findings: InsightFinding[]) {
    if (!rel) return;
    const lineFixes = findings.filter((f) => fixFor(f.category)?.kind === "delete-line");
    if (lineFixes.length) byFile.set(rel, lineFixes);
    else byFile.delete(rel);
}

let registered = false;

// Surface unused-require fixes as Monaco quick-fixes (lightbulb). Done as a model
// edit so the open editor stays consistent and undo works.
export function registerInsightFixes(toRel: (uri: string) => string | null) {
    if (registered) return;
    registered = true;
    const provider: monaco.languages.CodeActionProvider = {
        provideCodeActions(model, range) {
            const rel = toRel(model.uri.toString());
            const items = rel ? byFile.get(rel) : null;
            const actions = (items ?? [])
                .filter((f) => f.line >= range.startLineNumber && f.line <= range.endLineNumber)
                .map<monaco.languages.CodeAction>((f) => ({
                    title: fixFor(f.category)!.label,
                    kind: "quickfix",
                    edit: {
                        edits: [
                            {
                                resource: model.uri,
                                versionId: model.getVersionId(),
                                textEdit: {
                                    range: new monaco.Range(f.line, 1, f.line + 1, 1),
                                    text: "",
                                },
                            },
                        ],
                    },
                }));
            return { actions, dispose() {} };
        },
    };
    for (const lang of ["lua", "luau"]) {
        monaco.languages.registerCodeActionProvider(lang, provider);
    }
}
