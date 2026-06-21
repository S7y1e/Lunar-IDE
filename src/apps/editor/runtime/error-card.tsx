import { useState, useEffect } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { VscChevronRight, VscChevronDown } from "react-icons/vsc";
import { type ErrorGroup } from "./error-group";
import styles from "./runtime.module.scss";

const CONTEXT_RADIUS = 2;

type Props = {
    group: ErrorGroup;
    root: string;
    resolve: (dotPath: string) => string | null;
    onOpen: (dotPath: string, line: number) => void;
};

type SourceContext = {
    lines: { n: number; text: string }[];
    target: number;
};

async function loadContext(
    root: string,
    relPath: string,
    line: number,
): Promise<SourceContext | null> {
    try {
        const abs = await join(root, ...relPath.split("/"));
        const text = await readTextFile(abs);
        const all = text.split("\n");
        const from = Math.max(0, line - 1 - CONTEXT_RADIUS);
        const to = Math.min(all.length - 1, line - 1 + CONTEXT_RADIUS);
        return {
            lines: all.slice(from, to + 1).map((t, i) => ({ n: from + i + 1, text: t })),
            target: line,
        };
    } catch {
        return null;
    }
}

// Strip the "X.Y:N: " prefix that Roblox prepends to the error message text.
function stripLocationPrefix(msg: string): string {
    return msg.replace(/^(?:[A-Za-z_]\w*)(?:\.[A-Za-z_]\w*)+:\d+:\s*/, "");
}

export default function ErrorCard({ group, root, resolve, onOpen }: Props) {
    const [expanded, setExpanded] = useState(true);
    const [ctx, setCtx] = useState<SourceContext | null>(null);

    const topFrame = group.frames.find((f) => resolve(f.dotPath) !== null);

    useEffect(() => {
        if (!topFrame) return;
        const relPath = resolve(topFrame.dotPath);
        if (!relPath) return;
        loadContext(root, relPath, topFrame.line).then(setCtx);
    }, [root, topFrame?.dotPath, topFrame?.line]);

    const message = stripLocationPrefix(group.message);

    return (
        <div className={styles.errorCard}>
            <button
                className={styles.errorCardHeader}
                onClick={() => setExpanded((v) => !v)}
            >
                <span className={styles.errorIcon}>✕</span>
                <span className={styles.errorMessage}>{message}</span>
                {expanded ? <VscChevronDown size={12} /> : <VscChevronRight size={12} />}
            </button>

            {expanded && (
                <div className={styles.errorBody}>
                    {ctx && (
                        <div className={styles.sourceCtx}>
                            {ctx.lines.map(({ n, text }) => (
                                <div
                                    key={n}
                                    className={`${styles.ctxLine} ${n === ctx.target ? styles.ctxTarget : ""}`}
                                >
                                    <span className={styles.ctxNum}>{n}</span>
                                    <span className={styles.ctxText}>{text}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {group.frames.length > 0 && (
                        <div className={styles.stackFrames}>
                            {group.frames.map((frame, i) => {
                                const rel = resolve(frame.dotPath);
                                return (
                                    <div
                                        key={i}
                                        className={`${styles.frame} ${rel ? styles.frameLink : styles.frameUnresolved}`}
                                        onClick={() => rel && onOpen(frame.dotPath, frame.line)}
                                        title={rel ? `${rel}:${frame.line}` : `${frame.dotPath} not in project`}
                                    >
                                        <span className={styles.frameIndex}>{i + 1}</span>
                                        <span className={styles.framePath}>{frame.dotPath}</span>
                                        <span className={styles.frameLine}>:{frame.line}</span>
                                        {frame.label && (
                                            <span className={styles.frameLabel}> — {frame.label}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
