// UiNode tree -> a Luau script that builds the UI and parents it in Studio.
// Sent over the runtime bridge as { type: "eval", code } so the plugin runs it.
// Offset coordinates; images left as placeholders (asset pass fills them later).

import type { UiNode } from "./figma-types";

export interface CodegenOptions {
    root: "ScreenGui" | "Frame";
    mode?: "Offset" | "Scaled"; // Offset = fixed px; Scaled = fractions of parent (responsive)
    parent?: string; // Luau expr for the root's parent; default StarterGui
}

const KEYWORDS = new Set(["end", "do", "if", "for", "in", "function", "local", "then", "else"]);

function luauStr(s: string): string {
    return JSON.stringify(s); // double-quoted with \n/\" escapes — valid Luau
}

function isText(cls: string): boolean {
    return cls === "TextLabel" || cls === "TextButton" || cls === "TextBox";
}

export function generateLuau(tree: UiNode, opts: CodegenOptions): string {
    const lines: string[] = [];
    const used = new Map<string, number>();

    const varName = (name: string): string => {
        let base = (name[0]?.toLowerCase() ?? "n") + name.slice(1);
        if (KEYWORDS.has(base)) base = "_" + base;
        const n = (used.get(base) ?? 0) + 1;
        used.set(base, n);
        return n === 1 ? base : `${base}_${n}`;
    };

    const rgb = (c: [number, number, number]) => `Color3.fromRGB(${c[0]}, ${c[1]}, ${c[2]})`;
    const scaled = opts.mode === "Scaled";
    const frac = (n: number, d: number) => (d ? +(n / d).toFixed(4) : 0);

    const emitProps = (v: string, node: UiNode) => {
        const p = node.props;
        if (isText(node.className)) {
            if (p.text !== undefined) lines.push(`${v}.Text = ${luauStr(p.text)}`);
            if (p.textColor) lines.push(`${v}.TextColor3 = ${rgb(p.textColor)}`);
            if (p.textSize) lines.push(`${v}.TextSize = ${p.textSize}`);
            if (p.font) lines.push(`${v}.Font = Enum.Font.${p.font}`);
            if (p.textXAlign) lines.push(`${v}.TextXAlignment = Enum.TextXAlignment.${p.textXAlign}`);
        }
        if (p.backgroundColor) lines.push(`${v}.BackgroundColor3 = ${rgb(p.backgroundColor)}`);
        if (p.backgroundTransparency !== undefined)
            lines.push(`${v}.BackgroundTransparency = ${p.backgroundTransparency}`);
        if (p.clipsDescendants) lines.push(`${v}.ClipsDescendants = true`);
        if (p.hasImageFill && (node.className === "ImageLabel" || node.className === "ImageButton"))
            lines.push(`${v}.Image = "" -- TODO: asset`);

        if (p.cornerRadius) {
            const c = varName(node.name + "Corner");
            lines.push(`local ${c} = Instance.new("UICorner")`);
            lines.push(`${c}.CornerRadius = UDim.new(0, ${p.cornerRadius})`);
            lines.push(`${c}.Parent = ${v}`);
        }
        if (p.layout) {
            const l = varName(node.name + "Layout");
            lines.push(`local ${l} = Instance.new("UIListLayout")`);
            lines.push(`${l}.FillDirection = Enum.FillDirection.${p.layout.dir}`);
            lines.push(`${l}.Padding = UDim.new(0, ${p.layout.spacing})`);
            lines.push(`${l}.Parent = ${v}`);
        }
    };

    const emit = (node: UiNode, parentVar: string | null, parent: UiNode | null): string => {
        const v = varName(node.name);
        lines.push(`local ${v} = Instance.new("${node.className}")`);
        lines.push(`${v}.Name = ${luauStr(node.name)}`);

        if (scaled && parent) {
            lines.push(
                `${v}.Size = UDim2.fromScale(${frac(node.size.w, parent.size.w)}, ${frac(node.size.h, parent.size.h)})`,
            );
            lines.push(
                `${v}.Position = UDim2.fromScale(${frac(node.pos.x, parent.size.w)}, ${frac(node.pos.y, parent.size.h)})`,
            );
        } else if (scaled) {
            lines.push(`${v}.Size = UDim2.fromScale(1, 1)`); // root fills its parent
        } else {
            lines.push(`${v}.Size = UDim2.fromOffset(${node.size.w}, ${node.size.h})`);
            if (parentVar)
                lines.push(`${v}.Position = UDim2.fromOffset(${node.pos.x}, ${node.pos.y})`);
        }

        emitProps(v, node);
        if (parentVar) lines.push(`${v}.Parent = ${parentVar}`);
        for (const c of node.children) emit(c, v, node);
        return v;
    };

    const parentExpr = opts.parent ?? `game:GetService("StarterGui")`;

    if (opts.root === "ScreenGui") {
        const sg = varName(tree.name + "Gui");
        lines.push(`local ${sg} = Instance.new("ScreenGui")`);
        lines.push(`${sg}.Name = ${luauStr(tree.name)}`);
        lines.push(`${sg}.ResetOnSpawn = false`);
        lines.push(`${sg}.Parent = ${parentExpr}`);
        emit(tree, sg, null);
    } else {
        const rootVar = emit(tree, null, null);
        lines.push(`${rootVar}.Parent = ${parentExpr}`);
    }

    return `do\n\t${lines.join("\n\t")}\nend`;
}
