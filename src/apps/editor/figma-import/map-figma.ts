// Figma node tree -> normalized Roblox UI tree. The classification is a
// best-guess; the review UI lets the user override per node before codegen.

import type { FigmaFill, FigmaNode, RobloxClass, Rect, UiNode, UiProps } from "./figma-types";

const BTN = /button|btn|cta/i;

function rgb(c: { r: number; g: number; b: number }): [number, number, number] {
    return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

function solidFill(fills?: FigmaFill[]): FigmaFill | undefined {
    return fills?.find((f) => f.visible !== false && f.type === "SOLID" && f.color);
}

function hasImageFill(fills?: FigmaFill[]): boolean {
    return !!fills?.some((f) => f.visible !== false && f.type === "IMAGE");
}

// Figma has no Roblox font enum; map common families, fall back to Gotham.
const FONTS: Record<string, string> = {
    inter: "Gotham",
    roboto: "Gotham",
    montserrat: "Gotham",
    arial: "Arial",
    "source sans pro": "SourceSans",
    "source sans": "SourceSans",
};
function mapFont(family?: string): string {
    return (family && FONTS[family.toLowerCase()]) || "Gotham";
}

// Signals ranked: prototype interaction / name => button; else fill/type.
function classify(node: FigmaNode): RobloxClass {
    const button = BTN.test(node.name) || (node.interactions?.length ?? 0) > 0;
    const img = hasImageFill(node.fills);
    if (node.type === "TEXT") return button ? "TextButton" : "TextLabel";
    if (button) return "ImageButton";
    if (img) return "ImageLabel";
    switch (node.type) {
        case "FRAME":
        case "GROUP":
        case "COMPONENT":
        case "INSTANCE":
            return "Frame";
        default: // RECTANGLE / VECTOR / ELLIPSE / LINE / ... -> a graphic
            return "ImageLabel";
    }
}

function buildProps(node: FigmaNode, cls: RobloxClass): UiProps {
    const p: UiProps = {};
    const isText = cls === "TextLabel" || cls === "TextButton" || cls === "TextBox";
    const fill = solidFill(node.fills);

    if (isText) {
        p.backgroundTransparency = 1;
        if (node.characters !== undefined) p.text = node.characters;
        if (fill?.color) p.textColor = rgb(fill.color);
        if (node.style?.fontSize) p.textSize = Math.round(node.style.fontSize);
        p.font = mapFont(node.style?.fontFamily);
        const a = node.style?.textAlignHorizontal;
        p.textXAlign = a === "CENTER" ? "Center" : a === "RIGHT" ? "Right" : "Left";
    } else if (fill?.color) {
        p.backgroundColor = rgb(fill.color);
        const a = fill.color.a ?? 1;
        if (a < 1) p.backgroundTransparency = +(1 - a).toFixed(2);
    } else {
        p.backgroundTransparency = 1;
    }

    if (node.clipsContent) p.clipsDescendants = true;
    const r = node.cornerRadius ?? node.rectangleCornerRadii?.[0];
    if (r) p.cornerRadius = r;
    if (node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL") {
        p.layout = {
            dir: node.layoutMode === "HORIZONTAL" ? "Horizontal" : "Vertical",
            spacing: node.itemSpacing ?? 0,
        };
    }
    if (hasImageFill(node.fills)) p.hasImageFill = true;
    return p;
}

function mapNode(node: FigmaNode, parentBox?: Rect): UiNode {
    const box = node.absoluteBoundingBox;
    const cls = classify(node);
    const pos =
        box && parentBox
            ? { x: Math.round(box.x - parentBox.x), y: Math.round(box.y - parentBox.y) }
            : { x: 0, y: 0 };
    const size = box ? { w: Math.round(box.width), h: Math.round(box.height) } : { w: 0, h: 0 };
    return {
        id: node.id,
        name: node.name,
        className: cls,
        guess: cls,
        pos,
        size,
        props: buildProps(node, cls),
        children: (node.children ?? []).map((c) => mapNode(c, box)),
    };
}

// Entry point: the root frame maps relative to itself (pos 0,0).
export function mapFigma(root: FigmaNode): UiNode {
    return mapNode(root, root.absoluteBoundingBox);
}
