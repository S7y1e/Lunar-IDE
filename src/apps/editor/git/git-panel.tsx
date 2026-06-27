import { useMemo, useState } from "react";
import { VscGitMerge, VscRepo, VscArrowUp, VscArrowDown, VscScreenFull } from "react-icons/vsc";
import { isStaged, type GitFile } from "../../../lib/git";
import { useGit } from "./use-git";
import GitGraph from "./git-graph";
import styles from "./git.module.scss";

const STATUS_LABEL: Record<string, string> = {
    M: "M", A: "A", D: "D", R: "R", C: "C", "?": "U", U: "!",
};
const baseName = (p: string) => p.split("/").pop() ?? p;
const codeClass = (c: string, s: typeof styles) =>
    c === "?" ? s.cUnt : c === "A" ? s.cAdd : c === "D" ? s.cDel : s.cMod;

type Tab = "changes" | "graph";

type Props = {
    root: string;
    onOpenAt: (file: string, line: number, column: number) => void;
    onOpenGraph: () => void;
};

export default function GitPanel({ root, onOpenAt, onOpenGraph }: Props) {
    const git = useGit(root);
    const [tab, setTab] = useState<Tab>("changes");
    const [message, setMessage] = useState("");
    const [selected, setSelected] = useState<string | null>(null);

    const { staged, unstaged } = useMemo(() => {
        const files = git.status?.files ?? [];
        return {
            staged: files.filter(isStaged),
            unstaged: files.filter((f) => f.work !== " "),
        };
    }, [git.status]);

    if (git.isRepo === false)
        return (
            <div className={styles.panel}>
                <div className={styles.header}>
                    <VscGitMerge size={14} /> <span>Git</span>
                </div>
                <div className={styles.empty}>Not a git repository.</div>
            </div>
        );

    const onCommit = () => {
        if (!message.trim()) return;
        git.commit(message).then(() => setMessage(""));
    };

    const detail = selected ? git.commits.find((c) => c.hash === selected) : null;

    const row = (f: GitFile, staged: boolean) => (
        <div key={(staged ? "s" : "u") + f.path} className={styles.fileRow}>
            <span className={`${styles.code} ${codeClass(staged ? f.index : f.work, styles)}`}>
                {STATUS_LABEL[staged ? f.index : f.work] ?? "?"}
            </span>
            <button
                className={styles.fileName}
                title={f.path}
                onClick={() => onOpenAt(f.path, 1, 1)}
            >
                {baseName(f.path)}
                <span className={styles.dir}>{f.path}</span>
            </button>
            {staged ? (
                <button className={styles.act} title="Unstage" onClick={() => git.unstage(f.path)}>−</button>
            ) : (
                <>
                    <button className={styles.act} title="Discard" onClick={() => git.discard(f.path)}>⨯</button>
                    <button className={styles.act} title="Stage" onClick={() => git.stage(f.path)}>+</button>
                </>
            )}
        </div>
    );

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <VscGitMerge size={14} />
                <span>Git</span>
                {git.status && (
                    <span className={styles.branch}>
                        <VscRepo size={11} /> {git.status.branch}
                        {git.status.ahead > 0 && <><VscArrowUp size={10} />{git.status.ahead}</>}
                        {git.status.behind > 0 && <><VscArrowDown size={10} />{git.status.behind}</>}
                    </span>
                )}
            </div>

            <div className={styles.tabs}>
                <button className={tab === "changes" ? styles.tabOn : styles.tab} onClick={() => setTab("changes")}>
                    Changes
                </button>
                <button className={tab === "graph" ? styles.tabOn : styles.tab} onClick={() => setTab("graph")}>
                    Graph
                </button>
                <button className={styles.graphBtn} title="Open graph in editor" onClick={onOpenGraph}>
                    <VscScreenFull size={14} />
                </button>
            </div>

            {git.error && <div className={styles.error}>{git.error}</div>}

            {tab === "changes" ? (
                <div className={styles.body}>
                    <div className={styles.commitBox}>
                        <textarea
                            className={styles.msg}
                            placeholder="Commit message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={2}
                        />
                        <button className={styles.commitBtn} disabled={!message.trim() || staged.length === 0} onClick={onCommit}>
                            Commit {staged.length > 0 && `(${staged.length})`}
                        </button>
                    </div>

                    {staged.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionHead}>
                                Staged <span className={styles.count}>{staged.length}</span>
                            </div>
                            {staged.map((f) => row(f, true))}
                        </div>
                    )}

                    <div className={styles.section}>
                        <div className={styles.sectionHead}>
                            Changes <span className={styles.count}>{unstaged.length}</span>
                            {unstaged.length > 0 && (
                                <button className={styles.stageAll} onClick={() => git.stageAll()}>Stage all</button>
                            )}
                        </div>
                        {unstaged.length === 0 ? (
                            <div className={styles.empty}>Working tree clean.</div>
                        ) : (
                            unstaged.map((f) => row(f, false))
                        )}
                    </div>
                </div>
            ) : (
                <div className={styles.body}>
                    <GitGraph commits={git.commits} selected={selected} onSelect={setSelected} />
                    {detail && (
                        <div className={styles.detail}>
                            <div className={styles.detailHash}>{detail.short}</div>
                            <div className={styles.detailSubject}>{detail.subject}</div>
                            <div className={styles.detailMeta}>{detail.author}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
