// Minimal Figma REST node shape (only the fields the mapper reads) plus the
// normalized Roblox UI tree it produces. Pure data; no network.

export interface FigmaColor {
    r: number;
    g: number;
    b: number;
    a?: number;
}

export interface FigmaFill {
    type: string; // SOLID | IMAGE | GRADIENT_* | ...
    visible?: boolean;
    opacity?: number;
    color?: FigmaColor;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface FigmaStyle {
    fontFamily?: string;
    fontSize?: number;
    textAlignHorizontal?: string; // LEFT | CENTER | RIGHT | JUSTIFIED
}

export interface FigmaNode {
    id: string;
    name: string;
    type: string;
    children?: FigmaNode[];
    absoluteBoundingBox?: Rect;
    fills?: FigmaFill[];
    clipsContent?: boolean;
    cornerRadius?: number;
    rectangleCornerRadii?: number[];
    characters?: string;
    style?: FigmaStyle;
    layoutMode?: string; // HORIZONTAL | VERTICAL | NONE
    itemSpacing?: number;
    interactions?: unknown[]; // prototype reactions => button signal
}

export type RobloxClass =
    | "Frame"
    | "ScrollingFrame"
    | "CanvasGroup"
    | "TextLabel"
    | "TextButton"
    | "TextBox"
    | "ImageLabel"
    | "ImageButton"
    | "ViewportFrame";

export interface UiProps {
    backgroundColor?: [number, number, number]; // 0-255
    backgroundTransparency?: number;
    clipsDescendants?: boolean;
    cornerRadius?: number;
    text?: string;
    textColor?: [number, number, number];
    textSize?: number;
    font?: string;
    textXAlign?: "Left" | "Center" | "Right";
    layout?: { dir: "Horizontal" | "Vertical"; spacing: number };
    hasImageFill?: boolean; // needs a placeholder image; filled in the asset pass
}

export interface UiNode {
    id: string; // figma node id
    name: string; // sanitized Roblox Instance.Name
    figmaName: string; // original Figma layer name (for the review UI)
    className: RobloxClass; // current (possibly user-overridden) class
    guess: RobloxClass; // original heuristic guess, for Reset in the review UI
    pos: { x: number; y: number }; // offset px, relative to parent
    size: { w: number; h: number };
    props: UiProps;
    children: UiNode[];
}
