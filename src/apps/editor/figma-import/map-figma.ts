// Figma node tree -> normalized Roblox UI tree. The classification is a
// best-guess; the review UI lets the user override per node before codegen.

import type { FigmaFill, FigmaNode, RobloxClass, Rect, UiNode, UiProps } from "./figma-types";
import { parseName } from "./naming";

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

// Text -> TextLabel, anything exported/image-filled -> ImageLabel, else a Frame
// (frames, groups, solid shapes). Buttons are NOT auto-detected — opt in per node
// via the `@ImageButton` / `@TextButton` name directive.
function classify(node: FigmaNode): RobloxClass {
    if (node.type === "TEXT") return "TextLabel";
    if (hasImageFill(node.fills) || node.imageHash) return "ImageLabel";
    return "Frame";
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

    const sf = solidFill(node.strokes);
    if (sf?.color && node.strokeWeight) {
        p.stroke = { color: rgb(sf.color), thickness: Math.max(1, Math.round(node.strokeWeight)) };
    }

    if (node.clipsContent) p.clipsDescendants = true;
    if (typeof node.cornerRadius === "number" && node.cornerRadius > 0) {
        p.cornerRadius = node.cornerRadius;
    } else if (node.rectangleCornerRadii?.some((x) => x > 0)) {
        const rr = node.rectangleCornerRadii;
        p.cornerRadii = [rr[0], rr[1], rr[2], rr[3]]; // per-corner for the preview
        p.cornerRadius = Math.max(...rr); // uniform approximation for Roblox UICorner
    }
    if (node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL") {
        p.layout = {
            dir: node.layoutMode === "HORIZONTAL" ? "Horizontal" : "Vertical",
            spacing: node.itemSpacing ?? 0,
        };
    }
    if (hasImageFill(node.fills)) p.hasImageFill = true;
    if (node.imageHash) p.imageHash = node.imageHash;
    return p;
}

// Returns null for excluded nodes (`@exclude` / leading `_`), which drops the subtree.
function mapNode(node: FigmaNode, parentBox?: Rect): UiNode | null {
    const info = parseName(node.name);
    if (info.excluded) return null;

    const cls = info.forcedClass ?? (info.scroll ? "ScrollingFrame" : classify(node));
    const box = node.absoluteBoundingBox;
    const pos =
        box && parentBox
            ? { x: Math.round(box.x - parentBox.x), y: Math.round(box.y - parentBox.y) }
            : { x: 0, y: 0 };
    const size = box ? { w: Math.round(box.width), h: Math.round(box.height) } : { w: 0, h: 0 };
    return {
        id: node.id,
        name: info.name,
        figmaName: node.name,
        className: cls,
        guess: cls,
        pos,
        size,
        props: buildProps(node, cls),
        children: (node.children ?? [])
            .map((c) => mapNode(c, box))
            .filter((c): c is UiNode => c !== null),
    };
}

// Entry point: the root frame maps relative to itself (pos 0,0).
export function mapFigma(root: FigmaNode): UiNode | null {
    return mapNode(root, root.absoluteBoundingBox);
}
