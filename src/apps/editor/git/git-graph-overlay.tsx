import { useEffect, useState } from "react";
import { VscClose, VscGitMerge } from "react-icons/vsc";
import { useGit } from "./use-git";
import GitGraph from "./git-graph";
import styles from "./git.module.scss";

type Props = {
    root: string;
    onClose: () => void;
};

export default function GitGraphOverlay({ root, onClose }: Props) {
    const git = useGit(root);
    const [selected, setSelected] = useState<string | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const detail = selected ? git.commits.find((c) => c.hash === selected) : null;

    return (
        <div className={styles.overlay}>
            <div className={styles.overlayHead}>
                <VscGitMerge size={15} />
                <span>Git Graph</span>
                {git.status && <span className={styles.overlayBranch}>{git.status.branch}</span>}
                <span className={styles.count}>{git.commits.length} commits</span>
                <button className={styles.overlayClose} onClick={onClose} title="Close (Esc)">
                    <VscClose size={18} />
                </button>
            </div>
            <div className={styles.overlayBody}>
                <GitGraph commits={git.commits} selected={selected} onSelect={setSelected} />
            </div>
            {detail && (
                <div className={styles.detail}>
                    <div className={styles.detailHash}>{detail.short}</div>
                    <div className={styles.detailSubject}>{detail.subject}</div>
                    <div className={styles.detailMeta}>
                        {detail.author}
                        {detail.refs.length > 0 && ` · ${detail.refs.join(", ")}`}
                    </div>
                </div>
            )}
        </div>
    );
}
