// Reads the selected frame locally (no REST, no rate limit) and POSTs to the
// Lunar bridge. Sends { root: <FigmaNode tree>, images: [{hash, png}] }: image
// fills / vectors are exported as PNG so the IDE can upload them. The IDE side is
// otherwise unchanged.

figma.showUI(__html__, { width: 260, height: 150 });

const BRIDGE = "http://localhost:34900/figma";

function paintOut(p) {
    const o = { type: p.type, visible: p.visible !== false, opacity: p.opacity };
    if (p.color) o.color = { r: p.color.r, g: p.color.g, b: p.color.b, a: p.opacity == null ? 1 : p.opacity };
    if (p.imageHash) o.imageRef = p.imageHash;
    if (p.gradientStops) o.gradientStops = p.gradientStops.map(() => ({}));
    return o;
}

// Leaf visual that has no native Roblox equivalent -> rasterize it to a PNG.
function needsImage(node) {
    const t = node.type;
    if (t === "VECTOR" || t === "STAR" || t === "BOOLEAN_OPERATION" || t === "POLYGON") return true;
    return Array.isArray(node.fills) && node.fills.some((f) => f.visible !== false && f.type === "IMAGE");
}

function djb2(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(16);
}

function extract(node, toExport) {
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
        o.rectangleCornerRadii = [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius];

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
    }

    if (needsImage(node)) toExport.push({ node, out: o });

    if (node.children) o.children = node.children.map((c) => extract(c, toExport));
    return o;
}

const MAX_SIDE = 256; // cap exported PNGs so the upload evals stay small

async function exportImages(toExport) {
    const images = [];
    const seen = {};
    for (const { node, out } of toExport) {
        try {
            const bb = node.absoluteBoundingBox;
            const maxSide = bb ? Math.max(bb.width, bb.height) : MAX_SIDE;
            const scale = Math.min(1, MAX_SIDE / maxSide);
            const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale } });
            const png = figma.base64Encode(bytes);
            const hash = djb2(png);
            out.imageHash = hash;
            if (!seen[hash]) {
                seen[hash] = true;
                images.push({ hash, png });
            }
        } catch (e) {
            // skip nodes that can't export; they stay placeholders
        }
    }
    return images;
}

function post(body) {
    return fetch(BRIDGE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }).then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
    });
}

figma.ui.onmessage = async (msg) => {
    if (msg.type !== "send") return;

    const sel = figma.currentPage.selection;
    if (sel.length === 0) {
        figma.ui.postMessage({ type: "status", ok: false, text: "Select a frame first." });
        return;
    }

    const toExport = [];
    const root = extract(sel[0], toExport);
    figma.ui.postMessage({ type: "status", ok: true, text: "Exporting " + toExport.length + " images…" });
    const images = await exportImages(toExport);

    try {
        // Structure first (small) so the preview opens immediately; images stream after.
        await post({ root });
        for (const im of images) await post({ image: im });
        figma.ui.postMessage({ type: "status", ok: true, text: "Sent to Lunar ✓ (" + images.length + " images)" });
    } catch (e) {
        figma.ui.postMessage({ type: "status", ok: false, text: "Lunar not reachable — is the app open?" });
    }
};
