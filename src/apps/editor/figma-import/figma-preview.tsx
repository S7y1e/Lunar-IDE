import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { VscClose } from "react-icons/vsc";
import { generateLuau } from "./generate-luau";
import { runtimeEnqueue } from "../../../lib/project";
import { buildApplyLuau, buildUploadLuau, getCachedAsset, pngToRgba, type FigmaImage } from "./upload-image";
import type { UiNode, RobloxClass } from "./figma-types";
import { NodeView, type SelectCtx, type TextPatch } from "./figma-node-view";
import FigmaTreeManager from "./figma-tree-manager";
import styles from "./figma-preview.module.scss";

type RootMode = "ScreenGui" | "Frame";
type SizeMode = "Offset" | "Scaled";

const CLASSES: RobloxClass[] = [
    "Frame", "ScrollingFrame", "CanvasGroup",
    "TextLabel", "TextButton", "TextBox",
    "ImageLabel", "ImageButton", "ViewportFrame",
];

function countNodes(n: UiNode): number {
    return 1 + n.children.reduce((s, c) => s + countNodes(c), 0);
}

function findNode(n: UiNode, id: string): UiNode | null {
    if (n.id === id) return n;
    for (const c of n.children) { const r = findNode(c, id); if (r) return r; }
    return null;
}

function patchTree(
    n: UiNode,
    overrides: Map<string, RobloxClass>,
    excluded: Set<string>,
    noStroke: Set<string>,
    textPatches: Map<string, TextPatch>,
    useFigmaNames: boolean,
): UiNode | null {
    if (excluded.has(n.id)) return null;
    let props = noStroke.has(n.id) ? { ...n.props, stroke: undefined } : n.props;
    const tp = textPatches.get(n.id);
    if (tp) {
        props = { ...props };
        if (tp.color) props.textColor = tp.color.match(/\d+/g)!.map(Number) as [number, number, number];
        if (tp.size !== undefined) props.textSize = tp.size;
        if (tp.transparent) props.backgroundTransparency = 1;
    }
    return {
        ...n,
        name: useFigmaNames ? n.figmaName : n.name,
        className: overrides.get(n.id) ?? n.className,
        props,
        children: n.children
            .map((c) => patchTree(c, overrides, excluded, noStroke, textPatches, useFigmaNames))
            .filter((c): c is UiNode => c !== null),
    };
}


export default function FigmaPreview({
    trees,
    images,
    onClose,
}: {
    trees: UiNode[];
    images: FigmaImage[];
    onClose: () => void;
}) {
    const [selectedIdx, setSelectedIdx] = useState(trees.length - 1);
    const [rootMode, setRootMode] = useState<RootMode>("ScreenGui");
    const [sizeMode, setSizeMode] = useState<SizeMode>("Scaled");
    const [sent, setSent] = useState(false);
    const [scale, setScale] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [overrides, setOverrides] = useState<Map<string, RobloxClass>>(new Map());
    const [excluded, setExcluded] = useState<Set<string>>(new Set());
    const [noStroke, setNoStroke] = useState<Set<string>>(new Set());
    const [textPatches, setTextPatches] = useState<Map<string, TextPatch>>(new Map());
    const [useFigmaNames, setUseFigmaNames] = useState(false);
    const viewRef = useRef<HTMLDivElement>(null);

    const tree = trees[Math.min(selectedIdx, trees.length - 1)];

    useEffect(() => {
        setSelectedIds(new Set());
    }, [selectedIdx]);

    useLayoutEffect(() => {
        if (!tree) return;
        const fit = () => {
            const el = viewRef.current;
            if (!el) return;
            const pad = 48;
            setScale(Math.min((el.clientWidth - pad) / tree.size.w, (el.clientHeight - pad) / tree.size.h, 1));
        };
        fit();
        const ro = new ResizeObserver(fit);
        if (viewRef.current) ro.observe(viewRef.current);
        return () => ro.disconnect();
    }, [tree]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const onSelect = useCallback((id: string, multi: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (multi) {
                if (next.has(id)) next.delete(id);
                else next.add(id);
            } else {
                if (next.size === 1 && next.has(id)) next.clear();
                else { next.clear(); next.add(id); }
            }
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        const ids = new Set<string>();
        const walk = (n: UiNode) => { ids.add(n.id); n.children.forEach(walk); };
        if (tree) walk(tree);
        setSelectedIds(ids);
    }, [tree]);

    const applyClass = (cls: RobloxClass | "exclude" | "reset") => {
        if (!selectedIds.size) return;
        if (cls === "exclude") {
            setExcluded((prev) => { const n = new Set(prev); selectedIds.forEach((id) => n.add(id)); return n; });
            setSelectedIds(new Set());
        } else if (cls === "reset") {
            setOverrides((prev) => { const n = new Map(prev); selectedIds.forEach((id) => n.delete(id)); return n; });
            setExcluded((prev) => { const n = new Set(prev); selectedIds.forEach((id) => n.delete(id)); return n; });
        } else {
            setOverrides((prev) => { const n = new Map(prev); selectedIds.forEach((id) => n.set(id, cls)); return n; });
        }
    };

    const toggleExclude = useCallback((id: string) => {
        setExcluded((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }, []);

    if (!tree) return null;

    const nodeCount = countNodes(tree);
    const imageMap = useMemo(
        () => new Map(images.map((img) => [img.hash, `data:image/png;base64,${img.png}`])),
        [images],
    );
    const selectCtx: SelectCtx = { selected: selectedIds, excluded, overrides, noStroke, textPatches, images: imageMap, onSelect };

    const singleNode = selectedIds.size === 1 ? findNode(tree, [...selectedIds][0]) : null;
    const singleCls = singleNode ? (overrides.get(singleNode.id) ?? singleNode.className) : null;
    const isTextNode = singleCls === "TextLabel" || singleCls === "TextButton" || singleCls === "TextBox";
    const patchSingle = (patch: Partial<TextPatch>) => {
        if (!singleNode) return;
        setTextPatches((prev) => {
            const n = new Map(prev);
            n.set(singleNode.id, { ...prev.get(singleNode.id), ...patch });
            return n;
        });
    };

    const send = async () => {
        const patched = patchTree(tree, overrides, excluded, noStroke, textPatches, useFigmaNames);
        if (!patched) return;
        const code = generateLuau(patched, { root: rootMode, mode: sizeMode });
        runtimeEnqueue({ type: "eval", code }).catch(() => {});
        for (const im of images) {
            const cached = getCachedAsset(im.hash);
            if (cached) {
                runtimeEnqueue({ type: "eval", code: buildApplyLuau(im.hash, cached) }).catch(() => {});
                continue;
            }
            try {
                const { rgba, w, h } = await pngToRgba(im.png);
                runtimeEnqueue({ type: "eval", code: buildUploadLuau(rgba, w, h, im.hash) }).catch(() => {});
                await new Promise((r) => setTimeout(r, 250));
            } catch { /* skip */ }
        }
        setSent(true);
        setTimeout(() => setSent(false), 2000);
    };

    return (
        <div className={styles.overlay}>
            <FigmaTreeManager
                trees={trees}
                selectedIdx={selectedIdx}
                onSelectTree={(i) => setSelectedIdx(i)}
                selectedIds={selectedIds}
                excluded={excluded}
                overrides={overrides}
                onSelectNode={onSelect}
                onToggleExclude={toggleExclude}
            />

            <div className={styles.main}>
                <div className={styles.header}>
                    <span className={styles.title}>Preview: &ldquo;{tree.name}&rdquo;</span>
                    <span className={styles.dims}>{tree.size.w} × {tree.size.h}</span>
                    <div className={styles.spacer} />
                    <div className={styles.seg}>
                        {(["Offset", "Scaled"] as SizeMode[]).map((m) => (
                            <button key={m} className={sizeMode === m ? styles.segOn : styles.segOff} onClick={() => setSizeMode(m)}>{m}</button>
                        ))}
                    </div>
                    <div className={styles.seg}>
                        {(["ScreenGui", "Frame"] as RootMode[]).map((m) => (
                            <button key={m} className={rootMode === m ? styles.segOn : styles.segOff} onClick={() => setRootMode(m)}>{m}</button>
                        ))}
                    </div>
                    <button className={styles.close} onClick={onClose} title="Close (Esc)"><VscClose size={18} /></button>
                </div>

                <div className={styles.viewport} ref={viewRef}>
                    <div className={styles.stage} style={{ width: tree.size.w, height: tree.size.h, transform: `scale(${scale})` }}>
                        <NodeView n={tree} ctx={selectCtx} />
                    </div>
                </div>

                <div className={styles.elementBar}>
                    {selectedIds.size > 0
                        ? `${selectedIds.size} selected — choose a class below`
                        : `${nodeCount} elements — click to select`}
                </div>

                {singleNode && (
                    <div className={styles.inspector}>
                        <span className={styles.inspectorName} title={singleNode.figmaName}>
                            {singleNode.figmaName}
                        </span>
                        <div className={styles.inspectorRow}>
                            {singleNode.props.stroke && (
                                <button
                                    className={`${styles.inspBtn} ${noStroke.has(singleNode.id) ? styles.inspBtnActive : ""}`}
                                    onClick={() => setNoStroke((prev) => { const n = new Set(prev); n.has(singleNode.id) ? n.delete(singleNode.id) : n.add(singleNode.id); return n; })}
                                    title="Toggle UIStroke"
                                >
                                    {noStroke.has(singleNode.id) ? "Stroke OFF" : "Stroke ON"}
                                </button>
                            )}
                            {isTextNode && (
                                <>
                                    <label className={styles.inspLabel}>Color</label>
                                    <input
                                        type="color"
                                        className={styles.inspColor}
                                        value={textPatches.get(singleNode.id)?.color ?? (singleNode.props.textColor ? `#${singleNode.props.textColor.map((v) => v.toString(16).padStart(2, "0")).join("")}` : "#ffffff")}
                                        onChange={(e) => patchSingle({ color: e.target.value })}
                                    />
                                    <label className={styles.inspLabel}>Size</label>
                                    <input
                                        type="number"
                                        className={styles.inspNumber}
                                        value={textPatches.get(singleNode.id)?.size ?? singleNode.props.textSize ?? 14}
                                        min={6} max={120}
                                        onChange={(e) => patchSingle({ size: Number(e.target.value) })}
                                    />
                                    <button
                                        className={`${styles.inspBtn} ${textPatches.get(singleNode.id)?.transparent ? styles.inspBtnActive : ""}`}
                                        onClick={() => patchSingle({ transparent: !textPatches.get(singleNode.id)?.transparent })}
                                        title="Toggle background transparent"
                                    >
                                        BG Transparent
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className={styles.classBar}>
                    <button className={styles.selectAll} onClick={selectAll}>Select All</button>
                    {CLASSES.map((cls) => (
                        <button
                            key={cls}
                            className={styles.clsBtn}
                            data-cls={cls}
                            onClick={() => applyClass(cls)}
                            disabled={!selectedIds.size}
                            title={cls}
                        >
                            {cls}
                        </button>
                    ))}
                    <button className={`${styles.clsBtn} ${styles.clsExclude}`} onClick={() => applyClass("exclude")} disabled={!selectedIds.size}>Exclude</button>
                    <button
                        className={styles.clsBtn}
                        disabled={!selectedIds.size}
                        onClick={() => setNoStroke((prev) => {
                            const n = new Set(prev);
                            selectedIds.forEach((id) => n.has(id) ? n.delete(id) : n.add(id));
                            return n;
                        })}
                    >No Stroke</button>
                    <button className={styles.clsBtn} onClick={() => applyClass("reset")} disabled={!selectedIds.size}>Reset</button>
                </div>

                <div className={styles.imagesPanel}>
                    <div className={styles.imagesPanelHeader}>
                        <span className={styles.imagesCount}>{images.length > 0 ? `${images.length} IMAGES` : "IMAGES"}</span>
                        <label className={styles.figmaNames}>
                            <input type="checkbox" checked={useFigmaNames} onChange={(e) => setUseFigmaNames(e.target.checked)} />
                            Use Figma Names
                        </label>
                    </div>
                    {images.length === 0 ? (
                        <div className={styles.noImages}>No images detected</div>
                    ) : (
                        <div className={styles.imageGrid}>
                            {images.map((img) => (
                                <div key={img.hash} className={styles.imageThumb}>
                                    <img src={`data:image/png;base64,${img.png}`} alt={img.hash} />
                                    <span>{img.hash.slice(0, 8)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className={styles.sendBar}>
                    <button className={styles.send} onClick={send}>{sent ? "Sent ✓" : "Send to Roblox"}</button>
                </div>
            </div>
        </div>
    );
}
