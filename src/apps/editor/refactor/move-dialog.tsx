import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import styles from "./rename.module.scss";
import { buildMovePlan, applyMovePlan, type MovePlan } from "./move-module";
import type { RenameEdit } from "./rename-module";

type Props = {
    root: string;
    activeFile: string;
    onClose: () => void;
    onDone: (newAbs: string) => void;
};

const baseName = (rel: string) => rel.split(/[\\/]/).pop() ?? rel;

export default function MoveDialog({ root, activeFile, onClose, onDone }: Props) {
    const [destDir, setDestDir] = useState("");
    const [plan, setPlan] = useState<MovePlan | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        const timer = setTimeout(() => {
            buildMovePlan(root, activeFile, destDir)
                .then((p) => alive && setPlan(p))
                .catch(() => alive && setPlan(null));
        }, 200);
        return () => {
            alive = false;
            clearTimeout(timer);
        };
    }, [destDir, root, activeFile]);

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
        if (!plan || busy || plan.newRel === plan.oldRel) return;
        setBusy(true);
        try {
            onDone(await applyMovePlan(root, plan));
        } finally {
            setBusy(false);
        }
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter") confirm();
        else if (e.key === "Escape") onClose();
    };

    const noop = plan != null && plan.newRel === plan.oldRel;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
                <div className={styles.title}>Move module</div>
                <div className={styles.from}>{baseName(activeFile)}</div>
                <input
                    className={styles.input}
                    value={destDir}
                    autoFocus
                    spellCheck={false}
                    placeholder="Destination folder (relative to project root)"
                    onChange={(e) => setDestDir(e.target.value)}
                    onKeyDown={onKeyDown}
                />

                {plan && (
                    <>
                        <div className={styles.summary}>
                            {noop
                                ? "Already in this folder."
                                : plan.edits.length === 0
                                  ? `Will move to ${plan.newRel} — no references to update.`
                                  : `Will move to ${plan.newRel}. ${plan.edits.length} reference${plan.edits.length === 1 ? "" : "s"} in ${groups.length} file${groups.length === 1 ? "" : "s"} will be updated.`}
                        </div>
                        <div className={styles.preview}>
                            {groups.map(([file, edits]) => (
                                <div key={file} className={styles.group}>
                                    <div className={styles.file}>{file}</div>
                                    {edits.map((edit, i) => (
                                        <div key={i} className={styles.edit}>
                                            <span className={styles.line}>{edit.line}</span>
                                            <code className={styles.after}>{edit.after.trim()}</code>
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
                        disabled={!plan || busy || noop}
                        onClick={confirm}
                    >
                        {busy ? "Moving…" : "Move"}
                    </button>
                </div>
            </div>
        </div>
    );
}
