import { useEffect, useMemo, useState } from "react";
import { VscChevronDown } from "react-icons/vsc";
import { memberUsages, type Usage } from "../../../lib/project";
import Highlight from "../search/highlight";
import styles from "../find/find.module.scss";

export type UsageTarget = { fromFile: string; receiver: string; member: string };

const baseName = (rel: string) => rel.split("/").pop() ?? rel;

type Props = {
    target: UsageTarget | null;
    onOpenAt: (file: string, line: number, column: number) => void;
};

export default function UsagesPanel({ target, onOpenAt }: Props) {
    const [usages, setUsages] = useState<Usage[] | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!target) {
            setUsages(null);
            return;
        }
        setLoading(true);
        memberUsages(target.fromFile, target.receiver, target.member)
            .then(setUsages)
            .catch(() => setUsages([]))
            .finally(() => setLoading(false));
    }, [target]);

    const groups = useMemo(() => {
        const map = new Map<string, Usage[]>();
        for (const u of usages ?? []) {
            const list = map.get(u.file) ?? [];
            list.push(u);
            map.set(u.file, list);
        }
        return [...map.entries()];
    }, [usages]);

    const total = usages?.length ?? 0;

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <span className={styles.title}>
                    <VscChevronDown size={14} />
                    Usages
                </span>
            </div>

            <div className={styles.summary}>
                {!target
                    ? "Put the cursor on a member and run “Find Usages”."
                    : loading
                      ? "Searching…"
                      : `${target.member}: ${total} usage${total === 1 ? "" : "s"} in ${groups.length} file${groups.length === 1 ? "" : "s"}`}
            </div>

            <div className={styles.body}>
                {groups.map(([file, items]) => (
                    <div key={file} className={styles.group}>
                        <div className={styles.fileHead} title={file}>
                            <span className={styles.fileName}>{baseName(file)}</span>
                            <span className={styles.filePath}>{file}</span>
                            <span className={styles.count}>{items.length}</span>
                        </div>
                        {items.map((u, i) => (
                            <button
                                key={i}
                                className={styles.match}
                                onClick={() => onOpenAt(u.file, u.line, u.column)}
                                title={`${file}:${u.line}`}
                            >
                                <span className={styles.line}>{u.line}</span>
                                <span className={styles.preview}>
                                    <Highlight
                                        text={u.text}
                                        query={target?.member ?? ""}
                                    />
                                </span>
                            </button>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
