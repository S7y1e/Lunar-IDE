import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import styles from "./rename.module.scss";
import {
    buildRenamePlan,
    applyRenamePlan,
    type RenamePlan,
    type RenameEdit,
} from "./rename-module";

type Props = {
    root: string;
    activeFile: string;
    onClose: () => void;
    onDone: (newAbs: string) => void;
};

const baseName = (rel: string) => rel.split(/[\\/]/).pop() ?? rel;

export default function RenameDialog({ root, activeFile, onClose, onDone }: Props) {
    const [newName, setNewName] = useState("");
    const [plan, setPlan] = useState<RenamePlan | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!newName.trim()) {
            setPlan(null);
            return;
        }
        let alive = true;
        const timer = setTimeout(() => {
            buildRenamePlan(root, activeFile, newName)
                .then((p) => alive && setPlan(p))
                .catch(() => alive && setPlan(null));
        }, 200);
        return () => {
            alive = false;
            clearTimeout(timer);
        };
    }, [newName, root, activeFile]);

    const groups = useMemo(() => {
        const map = new Map<string, RenameEdit[]>();
        for (const edit of plan?.edits ?? []) {
            const list = map.get(edit.file) ?? [];
            list.push(edit);
            map.set(edit.file, list);
        }
        return [...map.entries()];
    }, [plan]);

    const confirm = async () => {
        if (!plan || busy) return;
        setBusy(true);
        try {
            const newAbs = await applyRenamePlan(root, plan);
            onDone(newAbs);
        } finally {
            setBusy(false);
        }
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter") confirm();
        else if (e.key === "Escape") onClose();
    };

    const isModule = newName.trim() === "" || plan !== null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.title}>Rename module</div>
                <div className={styles.from}>{baseName(activeFile)}</div>
                <input
                    className={styles.input}
                    value={newName}
                    autoFocus
                    spellCheck={false}
                    placeholder="New name (without extension)"
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={onKeyDown}
                />

                {!isModule && (
                    <div className={styles.warn}>
                        Open a module file (.luau/.lua) to rename it.
                    </div>
                )}

                {plan && (
                    <>
                        <div className={styles.summary}>
                            {plan.edits.length === 0
                                ? "No references to update — only the file will be renamed."
                                : `${plan.edits.length} reference${plan.edits.length === 1 ? "" : "s"} in ${groups.length} file${groups.length === 1 ? "" : "s"} will be updated.`}
                        </div>
                        <div className={styles.preview}>
                            {groups.map(([file, edits]) => (
                                <div key={file} className={styles.group}>
                                    <div className={styles.file}>{file}</div>
                                    {edits.map((edit, i) => (
                                        <div key={i} className={styles.edit}>
                                            <span className={styles.line}>{edit.line}</span>
                                            <code className={styles.after}>
                                                {edit.after.trim()}
                                            </code>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <div className={styles.actions}>
                    <button className={styles.cancel} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={styles.apply}
                        disabled={!plan || busy}
                        onClick={confirm}
                    >
                        {busy ? "Renaming…" : "Rename"}
                    </button>
                </div>
            </div>
        </div>
    );
}
