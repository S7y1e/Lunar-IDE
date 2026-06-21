import { VscClose, VscDebugAlt } from "react-icons/vsc";
import { type useLogpoints } from "./use-logpoints";
import styles from "./logpoint.module.scss";

const baseName = (rel: string) => rel.split("/").pop() ?? rel;

type Props = {
    logpoints: ReturnType<typeof useLogpoints>;
    onOpenAt: (file: string, line: number, column: number) => void;
};

export default function LogpointPanel({ logpoints, onOpenAt }: Props) {
    const { points, remove, toggleStack } = logpoints;

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <VscDebugAlt size={14} />
                <span>Logpoints</span>
            </div>

            <div className={styles.list}>
                {points.length === 0 ? (
                    <div className={styles.empty}>
                        Right-click an expression in the editor → “Add Logpoint”. They’re
                        injected automatically when you Play and cleaned up on Stop.
                    </div>
                ) : (
                    points.map((p) => (
                        <div key={p.id} className={styles.row}>
                            <button
                                className={styles.remove}
                                onClick={() => remove(p.id)}
                                title="Remove"
                            >
                                <VscClose size={12} />
                            </button>
                            <button
                                className={styles.loc}
                                onClick={() => onOpenAt(p.file, p.line, 1)}
                                title={`${p.file}:${p.line}`}
                            >
                                <span className={styles.expr}>{p.expr}</span>
                                <span className={styles.where}>
                                    {baseName(p.file)}:{p.line}
                                </span>
                            </button>
                            <button
                                className={`${styles.stack} ${p.includeStack ? styles.stackOn : ""}`}
                                onClick={() => toggleStack(p.id)}
                                title="Include call stack (debug.traceback)"
                            >
                                stack
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
