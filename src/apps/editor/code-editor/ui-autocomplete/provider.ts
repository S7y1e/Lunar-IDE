import * as monaco from "monaco-editor";
import { detectDslContext, type Library } from "./dsl-context";
import { loadRobloxModel, type RobloxModel } from "./model";

const LANGUAGES = ["lua", "luau"];
const Kind = monaco.languages.CompletionItemKind;
const SNIPPET = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

// Fusion key entries that aren't plain properties.
const FUSION_SENTINELS = [
    { label: "[Children]", insert: '[Children] = $0' },
    { label: "[Ref]", insert: "[Ref] = $0" },
    { label: "[Cleanup]", insert: "[Cleanup] = $0" },
    { label: '[Out "..."]', insert: '[Out "${1:Property}"] = $0' },
    { label: '[OnChange "..."]', insert: '[OnChange "${1:Property}"] = $0' },
];

function range(model: monaco.editor.ITextModel, position: monaco.IPosition): monaco.IRange {
    const word = model.getWordUntilPosition(position);
    return {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
    };
}

function keyItems(
    api: RobloxModel,
    className: string,
    library: Library,
    r: monaco.IRange
): monaco.languages.CompletionItem[] {
    const members = api.membersOf(className);
    if (!members) return [];
    const items: monaco.languages.CompletionItem[] = [];

    for (const p of members.props) {
        items.push({
            label: p.name,
            kind: Kind.Property,
            insertText: `${p.name} = $0`,
            insertTextRules: SNIPPET,
            detail: p.enumName ? `Enum.${p.enumName}` : className,
            sortText: "0" + p.name,
            range: r,
        });
    }

    for (const e of members.events) {
        const insert =
            library === "fusion"
                ? `[OnEvent "${e}"] = function($1)\n\t$0\nend`
                : `${e} = function($1)\n\t$0\nend`;
        items.push({
            label: library === "fusion" ? `[OnEvent "${e}"]` : e,
            kind: Kind.Event,
            insertText: insert,
            insertTextRules: SNIPPET,
            detail: `${className} event`,
            sortText: "1" + e,
            range: r,
        });
    }

    if (library === "fusion") {
        for (const s of FUSION_SENTINELS) {
            items.push({
                label: s.label,
                kind: Kind.Snippet,
                insertText: s.insert,
                insertTextRules: SNIPPET,
                detail: "Fusion",
                sortText: "2" + s.label,
                range: r,
            });
        }
    }

    return items;
}

function valueItems(
    api: RobloxModel,
    className: string,
    propName: string,
    r: monaco.IRange
): monaco.languages.CompletionItem[] {
    const members = api.membersOf(className);
    const prop = members?.props.find((p) => p.name === propName);
    if (!prop?.enumName) return [];
    const enumMembers = api.enumMembers(prop.enumName);
    if (!enumMembers) return [];
    return enumMembers.map((m) => ({
        label: `Enum.${prop.enumName}.${m}`,
        kind: Kind.EnumMember,
        insertText: `Enum.${prop.enumName}.${m}`,
        filterText: m,
        detail: `Enum.${prop.enumName}`,
        sortText: "0" + m,
        range: r,
    }));
}

export function registerUiAutocomplete(): monaco.IDisposable[] {
    void loadRobloxModel();
    return LANGUAGES.map((language) =>
        monaco.languages.registerCompletionItemProvider(language, {
            triggerCharacters: ["[", '"', "."],
            async provideCompletionItems(model, position) {
                const api = await loadRobloxModel();
                if (!api) return null;
                const offset = model.getOffsetAt(position);
                const ctx = detectDslContext(model.getValue(), offset);
                if (!ctx) return null;
                if (!api.creatable.has(ctx.className) && !api.membersOf(ctx.className)) return null;
                const r = range(model, position);
                const suggestions =
                    ctx.kind === "key"
                        ? keyItems(api, ctx.className, ctx.library, r)
                        : valueItems(api, ctx.className, ctx.propName, r);
                return { suggestions };
            },
        })
    );
}
