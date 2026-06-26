import type { CSSProperties } from "react";
import type { UiNode, RobloxClass } from "./figma-types";
import styles from "./figma-preview.module.scss";

export interface TextPatch { color?: string; size?: number; transparent?: boolean; }

export interface SelectCtx {
    selected: Set<string>;
    excluded: Set<string>;
    overrides: Map<string, RobloxClass>;
    noStroke: Set<string>;
    textPatches: Map<string, TextPatch>;
    images: Map<string, string>; // hash -> data:image/png;base64,...
    onSelect: (id: string, multi: boolean) => void;
}

function isText(cls: string) {
    return cls === "TextLabel" || cls === "TextButton" || cls === "TextBox";
}
function isImage(cls: string) {
    return cls === "ImageLabel" || cls === "ImageButton";
}

export function NodeView({ n, ctx }: { n: UiNode; ctx?: SelectCtx }) {
    const cls = ctx?.overrides.get(n.id) ?? n.className;
    const text = isText(cls);
    const excluded = ctx?.excluded.has(n.id) ?? false;
    const selected = ctx?.selected.has(n.id) ?? false;
    const p = n.props;

    const style: CSSProperties = {
        left: n.pos.x,
        top: n.pos.y,
        width: n.size.w,
        height: n.size.h,
        borderRadius: p.cornerRadii ? p.cornerRadii.map((r) => `${r}px`).join(" ") : p.cornerRadius,
        overflow: p.clipsDescendants ? "hidden" : undefined,
        opacity: excluded ? 0.25 : undefined,
    };
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
    if (p.stroke && !ctx?.noStroke.has(n.id) && p.stroke.color) {
        style.border = `${p.stroke.thickness}px solid rgb(${p.stroke.color.join(", ")})`;
    } else if (p.stroke && !ctx?.noStroke.has(n.id) && p.stroke.gradient) {
        const stops = p.stroke.gradient.stops
            .map((s) => `rgb(${s.color.join(",")}) ${Math.round(s.pos * 100)}%`)
            .join(", ");
        style.borderWidth = `${p.stroke.thickness}px`;
        style.borderStyle = "solid";
        style.borderImage = `linear-gradient(${p.stroke.gradient.rotation + 90}deg, ${stops}) 1`;
    }

    const imgSrc = isImage(cls) && p.imageHash ? ctx?.images.get(p.imageHash) : undefined;
    if (imgSrc) {
        style.backgroundImage = `url(${imgSrc})`;
        style.backgroundSize = "cover";
        style.backgroundPosition = "center";
    }

    const cls2 = [
        styles.node,
        isImage(cls) && p.hasImageFill && !imgSrc ? styles.placeholder : "",
        selected ? styles.nodeSelected : "",
    ].join(" ");

    return (
        <div
            className={cls2}
            style={style}
            title={n.figmaName}
            onClick={
                ctx
                    ? (e) => {
                          e.stopPropagation();
                          ctx.onSelect(n.id, e.shiftKey || e.metaKey || e.ctrlKey);
                      }
                    : undefined
            }
        >
            {text && (
                <span
                    className={styles.text}
                    style={{
                        color: (() => {
                            const tp = ctx?.textPatches.get(n.id);
                            if (tp?.color) return tp.color;
                            return p.textColor ? `rgb(${p.textColor.join(",")})` : undefined;
                        })(),
                        fontSize: ctx?.textPatches.get(n.id)?.size ?? p.textSize,
                        opacity: ctx?.textPatches.get(n.id)?.transparent ? 0 : undefined,
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
                <NodeView key={c.id} n={c} ctx={ctx} />
            ))}
        </div>
    );
}
