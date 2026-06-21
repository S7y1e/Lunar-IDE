import { useState } from "react";
import { VscAdd, VscClose, VscEye } from "react-icons/vsc";
import { type useEvalWatches } from "./use-eval-watches";
import styles from "./eval-watch.module.scss";

type Props = {
    watcher: ReturnType<typeof useEvalWatches>;
    running: boolean;
};

export default function EvalWatchPanel({ watcher, running }: Props) {
    const { watches, results, add, remove } = watcher;
    const [draft, setDraft] = useState("");

    const submit = () => {
        if (!draft.trim()) return;
        add(draft);
        setDraft("");
    };

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <VscEye size={14} />
                <span>Watches</span>
                <span className={`${styles.chip} ${running ? styles.on : styles.off}`}>
                    {running ? "live" : "offline"}
                </span>
            </div>

            <div className={styles.addRow}>
                <input
                    className={styles.input}
                    value={draft}
                    spellCheck={false}
                    placeholder="Lua expression to watch…"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                />
                <button className={styles.addBtn} onClick={submit} title="Add watch">
                    <VscAdd size={14} />
                </button>
            </div>

            <div className={styles.list}>
                {watches.length === 0 ? (
                    <div className={styles.empty}>
                        Add an expression to watch it live during a play-test.
                    </div>
                ) : (
                    watches.map((w) => {
                        const r = results.get(w.id);
                        return (
                            <div key={w.id} className={styles.row}>
                                <button
                                    className={styles.remove}
                                    onClick={() => remove(w.id)}
                                    title="Remove"
                                >
                                    <VscClose size={12} />
                                </button>
                                <span className={styles.expr}>{w.expr}</span>
                                <span className={styles.eq}>=</span>
                                <span
                                    className={`${styles.value} ${r && !r.ok ? styles.error : ""}`}
                                >
                                    {r ? r.value || "nil" : "…"}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
