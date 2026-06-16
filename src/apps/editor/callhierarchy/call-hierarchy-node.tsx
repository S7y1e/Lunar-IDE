import { useEffect, useState } from "react";
import { VscChevronRight, VscChevronDown, VscSymbolMethod } from "react-icons/vsc";
import { findCallers, type CallNode } from "./call-hierarchy";
import type { LspPosition } from "../code-editor/luau-lsp/convert";
import styles from "./call-hierarchy.module.scss";

type Props = {
    label: string;
    fnUri: string;
    fnPos: LspPosition;
    site?: { uri: string; line: number; column: number };
    ancestors: Set<string>;
    depth: number;
    onOpen: (uri: string, line: number, column: number) => void;
};

export default function CallHierarchyNode({
    label,
    fnUri,
    fnPos,
    site,
    ancestors,
    depth,
    onOpen,
}: Props) {
    const selfId = `${fnUri}:${fnPos.line}:${fnPos.character}`;
    const isCycle = ancestors.has(selfId);
    const [open, setOpen] = useState(depth === 0);
    const [children, setChildren] = useState<CallNode[] | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || children !== null || isCycle) return;
        setLoading(true);
        findCallers(fnUri, fnPos)
            .then(setChildren)
            .catch(() => setChildren([]))
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
                    title={label}
                    onClick={() =>
                        site
                            ? onOpen(site.uri, site.line, site.column)
                            : onOpen(fnUri, fnPos.line + 1, fnPos.character + 1)
                    }
                >
                    <VscSymbolMethod className={styles.icon} size={13} />
                    <span className={styles.name}>{label}</span>
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
                ) : children && children.length === 0 ? (
                    <div className={styles.note} style={indent(depth + 1)}>
                        No callers
                    </div>
                ) : (
                    (children ?? []).map((c) => (
                        <CallHierarchyNode
                            key={c.id}
                            label={c.label}
                            fnUri={c.fnUri}
                            fnPos={c.fnPos}
                            site={{ uri: c.siteUri, line: c.siteLine, column: c.siteColumn }}
                            ancestors={new Set([...ancestors, selfId])}
                            depth={depth + 1}
                            onOpen={onOpen}
                        />
                    ))
                ))}
        </div>
    );
}
