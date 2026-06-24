// Pure, model-agnostic detector: given source text and a cursor offset, decide
// whether the cursor sits inside a UI-library element props table and, if so,
// which Roblox class it describes and whether a key or a value is expected.

export type Library = "fusion" | "vide" | "react";

export type DslContext =
    | { kind: "key"; className: string; library: Library }
    | { kind: "value"; className: string; propName: string }
    | null;

type Tok = { t: "id" | "str" | "p"; v: string; end: number };

const ID_START = /[A-Za-z_]/;
const ID = /[A-Za-z0-9_]/;

// Map the element-factory identifier to its library. Conventional names; alias
// detection (`local New = Fusion.New`) is left to a later cut.
const FACTORY: Record<string, Library> = { New: "fusion", create: "vide" };
const REACT_CALLS = new Set(["createElement", "e"]);

function tokenize(src: string, limit: number): Tok[] {
    const toks: Tok[] = [];
    let i = 0;
    while (i < limit) {
        const c = src[i];
        if (c === " " || c === "\t" || c === "\r" || c === "\n") {
            i++;
            continue;
        }
        if (c === "-" && src[i + 1] === "-") {
            i += 2;
            if (src[i] === "[") {
                const close = longClose(src, i);
                if (close) {
                    const end = src.indexOf(close, i);
                    i = end < 0 ? limit : end + close.length;
                    continue;
                }
            }
            while (i < limit && src[i] !== "\n") i++;
            continue;
        }
        if (c === '"' || c === "'") {
            const start = ++i;
            while (i < limit && src[i] !== c) {
                if (src[i] === "\\") i++;
                i++;
            }
            toks.push({ t: "str", v: src.slice(start, i), end: i + 1 });
            i++;
            continue;
        }
        if (c === "[") {
            const close = longClose(src, i);
            if (close) {
                const inner = i + close.length;
                const end = src.indexOf(close, inner);
                toks.push({
                    t: "str",
                    v: src.slice(inner, end < 0 ? limit : end),
                    end: end < 0 ? limit : end + close.length,
                });
                i = end < 0 ? limit : end + close.length;
                continue;
            }
        }
        if (ID_START.test(c)) {
            const start = i;
            while (i < limit && ID.test(src[i])) i++;
            toks.push({ t: "id", v: src.slice(start, i), end: i });
            continue;
        }
        toks.push({ t: "p", v: c, end: i + 1 });
        i++;
    }
    return toks;
}

// `[[`, `[=[`, ... -> the matching close (`]]`, `]=]`). Null if not a long open.
function longClose(src: string, i: number): string | null {
    if (src[i] !== "[") return null;
    let j = i + 1;
    while (src[j] === "=") j++;
    if (src[j] !== "[") return null;
    return "]" + "=".repeat(j - i - 1) + "]";
}

export function detectDslContext(src: string, offset: number): DslContext {
    const toks = tokenize(src, offset);

    // Walk forward, tracking the bracket stack. Each `(` frame remembers the call
    // name and its first string arg so React's `createElement("X", { … })` table
    // can inherit the class name from the enclosing call.
    type Frame = { open: string; idx: number; call?: string; firstStr?: string };
    const stack: Frame[] = [];
    for (let k = 0; k < toks.length; k++) {
        const tk = toks[k];
        if (tk.t === "str") {
            const top = stack[stack.length - 1];
            // first argument of a call, e.g. createElement("X", …)
            if (top?.open === "(" && top.firstStr === undefined && top.idx === k - 1) {
                top.firstStr = tk.v;
            }
            continue;
        }
        if (tk.t !== "p") continue;
        if (tk.v === "(" || tk.v === "{" || tk.v === "[") {
            const frame: Frame = { open: tk.v, idx: k };
            if (tk.v === "(" && toks[k - 1]?.t === "id") frame.call = toks[k - 1].v;
            stack.push(frame);
        } else if (tk.v === ")" || tk.v === "}" || tk.v === "]") {
            stack.pop();
        }
    }

    // Innermost `{` frame is our candidate props table.
    let brace: { idx: number } | null = null;
    let parenCall: { call?: string; firstStr?: string } | null = null;
    for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].open === "{") {
            brace = { idx: stack[s].idx };
            for (let p = s - 1; p >= 0; p--) {
                if (stack[p].open === "(") {
                    parenCall = stack[p];
                    break;
                }
                if (stack[p].open === "{") break;
            }
            break;
        }
    }
    if (!brace) return null;

    // Resolve class name + library for this `{`.
    const before = toks[brace.idx - 1];
    let className: string | undefined;
    let library: Library | undefined;
    if (before?.t === "str" && toks[brace.idx - 2]?.t === "id") {
        const factory = FACTORY[toks[brace.idx - 2].v];
        if (factory) {
            className = before.v;
            library = factory;
        }
    }
    if (!className && parenCall?.call && REACT_CALLS.has(parenCall.call) && parenCall.firstStr) {
        className = parenCall.firstStr;
        library = "react";
    }
    if (!className || !library) return null;

    // Key vs value: look at tokens after the last entry separator inside the `{`.
    let sep = brace.idx;
    let depth = 0;
    for (let k = brace.idx + 1; k < toks.length; k++) {
        const v = toks[k].v;
        if (toks[k].t === "p") {
            if (v === "{" || v === "(" || v === "[") depth++;
            else if (v === "}" || v === ")" || v === "]") depth--;
            else if (depth === 0 && (v === "," || v === ";")) sep = k;
        }
    }
    const entry = toks.slice(sep + 1);
    const eq = entry.findIndex((t) => t.t === "p" && t.v === "=");
    if (eq >= 0) {
        const key = entry[eq - 1];
        if (key?.t === "id") return { kind: "value", className, propName: key.v };
        return null;
    }
    return { kind: "key", className, library };
}
