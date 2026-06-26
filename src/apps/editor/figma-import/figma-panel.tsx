import { FaFigma } from "react-icons/fa";
import { runtimeEnqueue } from "../../../lib/project";
import { UPLOAD_SPIKE } from "./upload-spike";
import type { UiNode } from "./figma-types";
import styles from "./figma.module.scss";

function Row({ node, depth }: { node: UiNode; depth: number }) {
    const { w, h } = node.size;
    return (
        <>
            <div className={styles.row} style={{ paddingLeft: 12 + depth * 14 }}>
                <span className={styles.cls} data-cls={node.className}>
                    {node.className}
                </span>
                <span className={styles.name}>{node.name}</span>
                <span className={styles.dims}>
                    {w}×{h}
                </span>
            </div>
            {node.children.map((c) => (
                <Row key={c.id} node={c} depth={depth + 1} />
            ))}
        </>
    );
}

export default function FigmaPanel({ onOpen, trees }: { onOpen: () => void; trees: UiNode[] }) {
    const last = trees[trees.length - 1] ?? null;
    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <FaFigma size={13} />
                <span>Figma</span>
            </div>

            <div className={styles.hint}>
                Use the <b>Lunar UI Export</b> Figma plugin to send a frame directly — no rate limit.
            </div>

            {last ? (
                <div className={styles.body}>
                    <button className={styles.reopen} onClick={onOpen}>
                        Open preview ({trees.length} section{trees.length !== 1 ? "s" : ""})
                    </button>
                    <Row node={last} depth={0} />
                </div>
            ) : (
                <div className={styles.empty}>No frame loaded yet. Use the Figma plugin to send one.</div>
            )}

            <button
                className={styles.reopen}
                onClick={() => runtimeEnqueue({ type: "eval", code: UPLOAD_SPIKE }).catch(() => {})}
                title="Studio must be connected; watch the Runtime panel for the result"
            >
                Test image upload (spike)
            </button>
        </div>
    );
}
