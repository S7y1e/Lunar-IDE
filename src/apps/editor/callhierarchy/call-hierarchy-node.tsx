import { useEffect, useState } from "react";
import { VscChevronRight, VscChevronDown, VscSymbolMethod } from "react-icons/vsc";
import { findCallers, type CallerSite } from "./call-hierarchy";
import styles from "./call-hierarchy.module.scss";

type Site = { file: string; line: number; column: number };

type Props = {
    name: string;
    site?: Site;
    ancestors: Set<string>;
    depth: number;
    onOpen: (file: string, line: number, column: number) => void;
};

export default function CallHierarchyNode({
    name,
    site,
    ancestors,
    depth,
    onOpen,
}: Props) {
    const isCycle = ancestors.has(name);
    const [open, setOpen] = useState(depth === 0);
    const [callers, setCallers] = useState<CallerSite[] | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || callers !== null || isCycle) return;
        setLoading(true);
        findCallers(name)
            .then(setCallers)
            .catch(() => setCallers([]))
            .finally(() => setLoading(false));
    }, [open]);

    const indent = (d: number) => ({ paddingLeft: 8 + d * 14 });

    return (
        <div>
            <div className={styles.row} style={indent(depth)}>
                {!isCycle ? (
                    <button className={styles.chevron} onClick={() => setOpen((o) => !o)}>
                        {open ? (
                            <VscChevronDown size={14} />
                        ) : (
                            <VscChevronRight size={14} />
                        )}
                    </button>
                ) : (
                    <span className={styles.chevronSpacer} />
                )}
                <button
                    className={styles.label}
                    title={site ? `${site.file}:${site.line}` : name}
                    onClick={() =>
                        site && onOpen(site.file, site.line, site.column)
                    }
                >
                    <VscSymbolMethod className={styles.icon} size={13} />
                    <span className={styles.name}>{name}</span>
                    {site && <span className={styles.site}>:{site.line}</span>}
                    {isCycle && (
                        <span className={styles.cycle} title="recursive">
                            ↻
                        </span>
                    )}
                </button>
            </div>

            {open &&
                !isCycle &&
                (loading ? (
                    <div className={styles.note} style={indent(depth + 1)}>
                        Loading…
                    </div>
                ) : callers && callers.length === 0 ? (
                    <div className={styles.note} style={indent(depth + 1)}>
                        No callers
                    </div>
                ) : (
                    (callers ?? []).map((c, i) => (
                        <CallHierarchyNode
                            key={`${c.caller}:${c.file}:${c.line}:${i}`}
                            name={c.caller}
                            site={{ file: c.file, line: c.line, column: c.column }}
                            ancestors={new Set([...ancestors, name])}
                            depth={depth + 1}
                            onOpen={onOpen}
                        />
                    ))
                ))}
        </div>
    );
}
