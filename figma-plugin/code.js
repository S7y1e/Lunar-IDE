// Reads the selected frame locally (no REST, no rate limit) and POSTs a
// FigmaNode-shaped tree to the Lunar bridge. Mirrors the REST fields the
// mapper consumes, so the IDE side is unchanged.

figma.showUI(__html__, { width: 260, height: 150 });

const BRIDGE = "http://localhost:34900/figma";

function paintOut(p) {
    const o = { type: p.type, visible: p.visible !== false, opacity: p.opacity };
    if (p.color) o.color = { r: p.color.r, g: p.color.g, b: p.color.b, a: p.opacity == null ? 1 : p.opacity };
    if (p.imageHash) o.imageRef = p.imageHash;
    if (p.gradientStops) o.gradientStops = p.gradientStops.map(() => ({}));
    return o;
}

function extract(node) {
    const o = { id: node.id, name: node.name, type: node.type };

    const b = node.absoluteBoundingBox;
    if (b) o.absoluteBoundingBox = { x: b.x, y: b.y, width: b.width, height: b.height };

    if (Array.isArray(node.fills)) o.fills = node.fills.map(paintOut);
    if (Array.isArray(node.strokes) && node.strokes.length) {
        o.strokes = node.strokes.map(paintOut);
        o.strokeWeight = typeof node.strokeWeight === "number" ? node.strokeWeight : 1;
    }

    if (typeof node.cornerRadius === "number") o.cornerRadius = node.cornerRadius;
    else if (typeof node.topLeftRadius === "number")
        o.rectangleCornerRadii = [
            node.topLeftRadius,
            node.topRightRadius,
            node.bottomRightRadius,
            node.bottomLeftRadius,
        ];

    if (typeof node.clipsContent === "boolean") o.clipsContent = node.clipsContent;

    if (node.type === "TEXT") {
        o.characters = node.characters;
        const f = node.fontName;
        o.style = {
            fontFamily: f && f.family ? f.family : undefined,
            fontSize: typeof node.fontSize === "number" ? node.fontSize : undefined,
            textAlignHorizontal: node.textAlignHorizontal,
        };
    }

    if (node.layoutMode && node.layoutMode !== "NONE") {
        o.layoutMode = node.layoutMode;
        o.itemSpacing = node.itemSpacing;
        o.paddingLeft = node.paddingLeft;
        o.paddingRight = node.paddingRight;
        o.paddingTop = node.paddingTop;
        o.paddingBottom = node.paddingBottom;
        o.primaryAxisAlignItems = node.primaryAxisAlignItems;
        o.counterAxisAlignItems = node.counterAxisAlignItems;
    }

    if (node.children) o.children = node.children.map(extract);
    return o;
}

figma.ui.onmessage = async (msg) => {
    if (msg.type !== "send") return;

    const sel = figma.currentPage.selection;
    if (sel.length === 0) {
        figma.ui.postMessage({ type: "status", ok: false, text: "Select a frame first." });
        return;
    }

    const tree = extract(sel[0]);
    try {
        const res = await fetch(BRIDGE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tree),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        figma.ui.postMessage({ type: "status", ok: true, text: "Sent to Lunar ✓" });
    } catch (e) {
        figma.ui.postMessage({
            type: "status",
            ok: false,
            text: "Lunar not reachable — is the app open?",
        });
    }
};
