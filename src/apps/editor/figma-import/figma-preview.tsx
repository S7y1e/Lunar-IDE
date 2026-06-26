import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { VscClose } from "react-icons/vsc";
import { generateLuau } from "./generate-luau";
import { runtimeEnqueue } from "../../../lib/project";
import { buildUploadLuau, pngToRgba, type FigmaImage } from "./upload-image";
import type { UiNode } from "./figma-types";
import styles from "./figma-preview.module.scss";

type RootMode = "ScreenGui" | "Frame";
type SizeMode = "Offset" | "Scaled";

function isText(cls: string): boolean {
    return cls === "TextLabel" || cls === "TextButton" || cls === "TextBox";
}
function isImage(cls: string): boolean {
    return cls === "ImageLabel" || cls === "ImageButton";
}

function NodeView({ n }: { n: UiNode }) {
    const p = n.props;
    const text = isText(n.className);
    const style: CSSProperties = {
        left: n.pos.x,
        top: n.pos.y,
        width: n.size.w,
        height: n.size.h,
        borderRadius: p.cornerRadii ? p.cornerRadii.map((r) => `${r}px`).join(" ") : p.cornerRadius,
        overflow: p.clipsDescendants ? "hidden" : undefined,
    };
    // Background transparency is the FILL's alpha, not the whole element's opacity
    // (applying it as opacity hid text nodes, which have a transparent background).
    if (!text && p.backgroundColor) {
        const a = p.backgroundTransparency !== undefined ? 1 - p.backgroundTransparency : 1;
        style.background = `rgba(${p.backgroundColor.join(", ")}, ${a})`;
    }
    if (!text && p.gradient) {
        const stops = p.gradient.stops
            .map((s) => `rgb(${s.color.join(",")}) ${Math.round(s.pos * 100)}%`)
            .join(", ");
        style.background = `linear-gradient(${p.gradient.rotation + 90}deg, ${stops})`;
    }
    if (p.stroke?.color) {
        style.border = `${p.stroke.thickness}px solid rgb(${p.stroke.color.join(", ")})`;
    } else if (p.stroke?.gradient) {
        const stops = p.stroke.gradient.stops
            .map((s) => `rgb(${s.color.join(",")}) ${Math.round(s.pos * 100)}%`)
            .join(", ");
        style.borderWidth = `${p.stroke.thickness}px`;
        style.borderStyle = "solid";
        style.borderImage = `linear-gradient(${p.stroke.gradient.rotation + 90}deg, ${stops}) 1`;
    }

    const placeholder = isImage(n.className) && p.hasImageFill ? styles.placeholder : undefined;

    return (
        <div className={`${styles.node} ${placeholder ?? ""}`} style={style} title={n.figmaName}>
            {text && (
                <span
                    className={styles.text}
                    style={{
                        color: p.textColor ? `rgb(${p.textColor.join(",")})` : undefined,
                        fontSize: p.textSize,
                        justifyContent:
                            p.textXAlign === "Center"
                                ? "center"
                                : p.textXAlign === "Right"
                                  ? "flex-end"
                                  : "flex-start",
                    }}
                >
                    {p.text}
                </span>
            )}
            {n.children.map((c) => (
                <NodeView key={c.id} n={c} />
            ))}
        </div>
    );
}

export default function FigmaPreview({
    tree,
    images,
    onClose,
}: {
    tree: UiNode | null;
    images: FigmaImage[];
    onClose: () => void;
}) {
    const [rootMode, setRootMode] = useState<RootMode>("ScreenGui");
    const [sizeMode, setSizeMode] = useState<SizeMode>("Scaled");
    const [sent, setSent] = useState(false);
    const [scale, setScale] = useState(1);
    const viewRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!tree) return;
        const fit = () => {
            const el = viewRef.current;
            if (!el) return;
            const pad = 48;
            const sx = (el.clientWidth - pad) / tree.size.w;
            const sy = (el.clientHeight - pad) / tree.size.h;
            setScale(Math.min(sx, sy, 1));
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

    if (!tree) return null;

    const send = async () => {
        const code = generateLuau(tree, { root: rootMode, mode: sizeMode });
        runtimeEnqueue({ type: "eval", code }).catch(() => {});
        // Upload each image: decode PNG -> RGBA here, then a Luau eval rebuilds the
        // pixels in Studio, uploads via CreateAssetAsync, and applies by LunarImage tag.
        for (const im of images) {
            try {
                const { rgba, w, h } = await pngToRgba(im.png);
                runtimeEnqueue({ type: "eval", code: buildUploadLuau(rgba, w, h, im.hash) }).catch(
                    () => {},
                );
                await new Promise((r) => setTimeout(r, 250)); // spread out so polls drain incrementally
            } catch {
                /* skip images that fail to decode */
            }
        }
        setSent(true);
        setTimeout(() => setSent(false), 2000);
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.header}>
                <span className={styles.title}>{tree.name}</span>
                <span className={styles.dims}>
                    {tree.size.w}×{tree.size.h}
                </span>
                <div className={styles.spacer} />
                <div className={styles.seg}>
                    {(["Offset", "Scaled"] as SizeMode[]).map((m) => (
                        <button
                            key={m}
                            className={sizeMode === m ? styles.segOn : styles.segOff}
                            onClick={() => setSizeMode(m)}
                        >
                            {m}
                        </button>
                    ))}
                </div>
                <div className={styles.seg}>
                    {(["ScreenGui", "Frame"] as RootMode[]).map((m) => (
                        <button
                            key={m}
                            className={rootMode === m ? styles.segOn : styles.segOff}
                            onClick={() => setRootMode(m)}
                        >
                            {m}
                        </button>
                    ))}
                </div>
                <button className={styles.send} onClick={send}>
                    {sent ? "Sent ✓" : "Send to Studio"}
                </button>
                <button className={styles.close} onClick={onClose} title="Close (Esc)">
                    <VscClose size={18} />
                </button>
            </div>

            <div className={styles.viewport} ref={viewRef}>
                <div
                    className={styles.stage}
                    style={{
                        width: tree.size.w,
                        height: tree.size.h,
                        transform: `scale(${scale})`,
                    }}
                >
                    <NodeView n={tree} />
                </div>
            </div>
        </div>
    );
}
