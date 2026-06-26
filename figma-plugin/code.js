// Reads the selected frame locally and POSTs to the Lunar bridge:
// { root: <FigmaNode tree>, images: [{hash, png}] }. Nodes that can't be rebuilt
// natively are exported as PNG for the IDE to upload.

figma.showUI(__html__, { width: 260, height: 150 });

const BRIDGE = "http://localhost:34900/figma";

// Name directives (mirror the IDE):
//   "_"/"@exclude" — gone entirely (hidden from the PNG, not recreated)
//   "@ignore"      — stays baked in the parent PNG, but not its own instance
function hasToken(node, name) {
    return (node.name || "")
        .trim()
        .split("@")
        .slice(1)
        .some((t) => t.trim().toLowerCase() === name);
}
function excluded(node) {
    return (node.name || "").trim()[0] === "_" || hasToken(node, "exclude");
}
function ignored(node) {
    return hasToken(node, "ignore");
}
function dropped(node) {
    return excluded(node) || ignored(node);
}

function paintOut(p) {
    const o = { type: p.type, visible: p.visible !== false, opacity: p.opacity };
    if (p.color) o.color = { r: p.color.r, g: p.color.g, b: p.color.b, a: p.opacity == null ? 1 : p.opacity };
    if (p.imageHash) o.imageRef = p.imageHash;
    if (p.gradientStops) {
        o.gradientStops = p.gradientStops.map((s) => ({
            position: s.position,
            color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a },
        }));
        if (p.gradientTransform) o.gradientTransform = p.gradientTransform;
    }
    return o;
}

// Flattened to a single PNG (children not recreated) instead of rebuilt natively:
// explicit @ImageLabel/@ImageButton, groups, non-native shapes, and image fills.
function needsImage(node) {
    if (hasToken(node, "imagelabel") || hasToken(node, "imagebutton")) return true;
    const t = node.type;
    if (t === "GROUP" || t === "VECTOR" || t === "STAR" || t === "BOOLEAN_OPERATION" || t === "POLYGON")
        return true;
    return Array.isArray(node.fills) && node.fills.some((f) => f.visible !== false && f.type === "IMAGE");
}

function djb2(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(16);
}

// Children recreated on top of a rasterized node: text and nested compositions.
// Everything else stays baked into the PNG; dropped nodes never recreate.
function collectOverlays(children, toExport) {
    const out = [];
    for (const c of children) {
        if (dropped(c)) continue;
        if (needsImage(c) || c.type === "TEXT") out.push(extract(c, toExport));
        else if (c.children) out.push(...collectOverlays(c.children, toExport));
    }
    return out;
}

function extract(node, toExport) {
    const o = { id: node.id, name: node.name, type: node.type };

    const b = node.absoluteBoundingBox;
    if (b) o.absoluteBoundingBox = { x: b.x, y: b.y, width: b.width, height: b.height };

    if (Array.isArray(node.fills)) o.fills = node.fills.map(paintOut);
    if (Array.isArray(node.strokes) && node.strokes.length) {
        o.strokes = node.strokes.map(paintOut);
        o.strokeWeight = typeof node.strokeWeight === "number" ? node.strokeWeight : 1;
        o.strokeAlign = node.strokeAlign; // INSIDE | OUTSIDE | CENTER
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

    if (needsImage(node)) {
        toExport.push({ node, out: o });
        if (node.children) {
            const overlays = collectOverlays(node.children, toExport);
            if (overlays.length) o.children = overlays;
        }
    } else if (node.children) {
        o.children = node.children.filter((c) => !dropped(c)).map((c) => extract(c, toExport));
    }
    return o;
}

// Roblox's CreateEditableImage rejects sides >= 2048, so we cap there. Anything
// smaller exports at native size (scale 1) — only oversized nodes get downscaled.
const MAX_SIDE = 2000;

function collectTexts(node, acc) {
    if (node.type === "TEXT") acc.push(node);
    else if (node.children) for (const c of node.children) collectTexts(c, acc);
}

function collectExcluded(node, acc) {
    if (!node.children) return;
    for (const c of node.children) {
        if (excluded(c)) acc.push(c);
        else collectExcluded(c, acc);
    }
}

async function exportImages(toExport) {
    const images = [];
    const seen = {};
    for (const { node, out } of toExport) {
        // Text is hidden via opacity (bbox stable) since it's recreated natively;
        // excluded nodes via visible=false. Ignored nodes stay — they belong in the PNG.
        const texts = [];
        collectTexts(node, texts);
        const prev = texts.map((t) => t.opacity);
        for (const t of texts) t.opacity = 0;
        const hidden = [];
        collectExcluded(node, hidden);
        const prevVis = hidden.map((h) => h.visible);
        for (const h of hidden) h.visible = false;
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
        } finally {
            texts.forEach((t, i) => (t.opacity = prev[i]));
            hidden.forEach((h, i) => (h.visible = prevVis[i]));
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
