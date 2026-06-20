import { useEffect, useState } from "react";
import { VscChecklist } from "react-icons/vsc";
import { watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { projectTodos, type TodoItem } from "../../../lib/project";
import styles from "./todo.module.scss";

const TAG_CLASS: Record<string, string> = {
    TODO: styles.tagTodo,
    FIXME: styles.tagFixme,
    HACK: styles.tagHack,
    NOTE: styles.tagNote,
    XXX: styles.tagXxx,
};

const baseName = (rel: string) => rel.split("/").pop() ?? rel;

type Props = {
    root: string;
    onOpenAt: (file: string, line: number, column: number) => void;
};

export default function TodoPanel({ root, onOpenAt }: Props) {
    const [items, setItems] = useState<TodoItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        let unwatch: UnwatchFn | null = null;

        const refresh = () => {
            projectTodos()
                .then((next) => { if (active) { setItems(next); setLoading(false); } })
                .catch(() => active && setLoading(false));
        };

        refresh();

        (async () => {
            try {
                const fn = await watch(
                    root,
                    (event) => {
                        if (event.paths.some((p) => p.endsWith(".luau") || p.endsWith(".lua"))) {
                            refresh();
                        }
                    },
                    { recursive: true, delayMs: 500 },
                );
                if (active) unwatch = fn;
                else fn();
            } catch (e) {
                console.warn("[todo] watch failed", e);
            }
        })();

        return () => { active = false; unwatch?.(); };
    }, [root]);

    // Group by file
    const groups = new Map<string, TodoItem[]>();
    for (const item of items) {
        const list = groups.get(item.file) ?? [];
        list.push(item);
        groups.set(item.file, list);
    }

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <VscChecklist size={14} />
                <span>TODO</span>
                {!loading && <span className={styles.count}>{items.length}</span>}
            </div>

            {loading ? (
                <div className={styles.empty}>Scanning…</div>
            ) : items.length === 0 ? (
                <div className={styles.empty}>No TODOs found.</div>
            ) : (
                <div className={styles.body}>
                    {[...groups.entries()].map(([file, fileItems]) => (
                        <div key={file} className={styles.group}>
                            <div className={styles.fileHead} title={file}>
                                <span className={styles.fileName}>{baseName(file)}</span>
                                <span className={styles.filePath}>{file}</span>
                                <span className={styles.fileCount}>{fileItems.length}</span>
                            </div>
                            {fileItems.map((item, i) => (
                                <button
                                    key={i}
                                    className={styles.row}
                                    onClick={() => onOpenAt(item.file, item.line, item.column)}
                                    title={`${file}:${item.line}`}
                                >
                                    <span className={`${styles.tag} ${TAG_CLASS[item.tag] ?? ""}`}>
                                        {item.tag}
                                    </span>
                                    <span className={styles.lineNum}>{item.line}</span>
                                    <span className={styles.text}>{item.text || "…"}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
