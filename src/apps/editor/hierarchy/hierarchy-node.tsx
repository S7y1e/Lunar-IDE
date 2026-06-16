import { useMemo, useState } from "react";
import { VscChevronRight, VscChevronDown, VscSymbolMethod } from "react-icons/vsc";
import styles from "./hierarchy.module.scss";

const baseName = (rel: string) => rel.split("/").pop() ?? rel;

type Props = {
    node: string;
    childrenOf: (node: string) => string[];
    ancestors: Set<string>;
    depth: number;
    onOpen: (rel: string) => void;
};

export default function HierarchyNode({
    node,
    childrenOf,
    ancestors,
    depth,
    onOpen,
}: Props) {
    // Stop recursing if this module already appears upward in the branch.
    const isCycle = ancestors.has(node);
    const children = useMemo(
        () => (isCycle ? [] : childrenOf(node)),
        [node, childrenOf, isCycle]
    );
    const [open, setOpen] = useState(depth === 0);
    const hasChildren = children.length > 0;

    return (
        <div>
            <div className={styles.row} style={{ paddingLeft: 8 + depth * 14 }}>
                {hasChildren ? (
                    <button
                        className={styles.chevron}
                        onClick={() => setOpen((o) => !o)}
                    >
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
                    onClick={() => onOpen(node)}
                    title={node}
                >
                    <VscSymbolMethod className={styles.icon} size={13} />
                    <span className={styles.name}>{baseName(node)}</span>
                    {isCycle && (
                        <span className={styles.cycle} title="cycle">
                            ↻
                        </span>
                    )}
                </button>
            </div>
            {open &&
                children.map((child) => (
                    <HierarchyNode
                        key={child}
                        node={child}
                        childrenOf={childrenOf}
                        ancestors={new Set([...ancestors, node])}
                        depth={depth + 1}
                        onOpen={onOpen}
                    />
                ))}
        </div>
    );
}
