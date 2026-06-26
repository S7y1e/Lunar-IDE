// Layer name -> sanitized Roblox Instance.Name + directives baked into the name.
//   "text test"            -> { name: "TextTest" }
//   "PlayButton@ImageButton" -> { name: "PlayButton", forcedClass: "ImageButton" }
//   "_Ignore" / "x@exclude"  -> { excluded: true }
//   "List@scroll"            -> { scroll: true }

import type { RobloxClass } from "./figma-types";

export interface NameInfo {
    name: string; // sanitized PascalCase identifier
    forcedClass?: RobloxClass;
    excluded: boolean;
    scroll: boolean;
}

const CLASS_TOKENS: Record<string, RobloxClass> = {
    frame: "Frame",
    scrollingframe: "ScrollingFrame",
    canvasgroup: "CanvasGroup",
    textlabel: "TextLabel",
    textbutton: "TextButton",
    textbox: "TextBox",
    imagelabel: "ImageLabel",
    imagebutton: "ImageButton",
    viewportframe: "ViewportFrame",
};

function sanitize(s: string): string {
    const parts = s.split(/[^A-Za-z0-9]+/).filter(Boolean);
    let out = parts.map((p) => p[0].toUpperCase() + p.slice(1)).join("");
    if (/^[0-9]/.test(out)) out = "_" + out; // identifiers can't start with a digit
    return out || "Node";
}

export function parseName(raw: string): NameInfo {
    const info: NameInfo = { name: "Node", excluded: false, scroll: false };
    let s = raw.trim();
    if (s.startsWith("_")) info.excluded = true;

    const segs = s.split("@");
    for (const tok of segs.slice(1)) {
        const t = tok.trim().toLowerCase();
        if (t === "exclude") info.excluded = true;
        else if (t === "scroll") info.scroll = true;
        else if (CLASS_TOKENS[t]) info.forcedClass = CLASS_TOKENS[t];
    }

    info.name = sanitize(segs[0]);
    return info;
}
