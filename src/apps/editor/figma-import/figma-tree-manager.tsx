import { useState } from "react";
import { VscChevronRight, VscChevronDown, VscEye, VscEyeClosed } from "react-icons/vsc";
import type { UiNode, RobloxClass } from "./figma-types";
import styles from "./figma-preview.module.scss";

interface Props {
    trees: UiNode[];
    selectedIdx: number;
    onSelectTree: (i: number) => void;
    selectedIds: Set<string>;
    excluded: Set<string>;
    overrides: Map<string, RobloxClass>;
    onSelectNode: (id: string, multi: boolean) => void;
    onToggleExclude: (id: string) => void;
}

function TreeRow({
    n,
    depth,
    selectedIds,
    excluded,
    overrides,
    onSelect,
    onToggleExclude,
    collapsed,
    onToggleCollapse,
}: {
    n: UiNode;
    depth: number;
    selectedIds: Set<string>;
    excluded: Set<string>;
    overrides: Map<string, RobloxClass>;
    onSelect: (id: string, multi: boolean) => void;
    onToggleExclude: (id: string) => void;
    collapsed: Set<string>;
    onToggleCollapse: (id: string) => void;
}) {
    const isExcluded = excluded.has(n.id);
    const isSelected = selectedIds.has(n.id);
    const isCollapsed = collapsed.has(n.id);
    const cls = overrides.get(n.id) ?? n.className;
    const hasChildren = n.children.length > 0;

    return (
        <>
            <div
                className={`${styles.treeRow} ${isSelected ? styles.treeRowSelected : ""} ${isExcluded ? styles.treeRowExcluded : ""}`}
                style={{ paddingLeft: 6 + depth * 14 }}
                onClick={(e) => onSelect(n.id, e.shiftKey || e.metaKey || e.ctrlKey)}
            >
                <span
                    className={styles.treeArrow}
                    onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggleCollapse(n.id); }}
                >
                    {hasChildren
                        ? (isCollapsed ? <VscChevronRight size={11} /> : <VscChevronDown size={11} />)
                        : <span style={{ display: "inline-block", width: 11 }} />}
                </span>
                <span className={styles.treeCls} data-cls={cls}>{cls}</span>
                <span className={styles.treeName}>{n.name}</span>
                <button
                    className={styles.treeEye}
                    onClick={(e) => { e.stopPropagation(); onToggleExclude(n.id); }}
                    title={isExcluded ? "Include" : "Exclude"}
                >
                    {isExcluded ? <VscEyeClosed size={12} /> : <VscEye size={12} />}
                </button>
            </div>
            {!isCollapsed && n.children.map((c) => (
                <TreeRow
                    key={c.id}
                    n={c}
                    depth={depth + 1}
                    selectedIds={selectedIds}
                    excluded={excluded}
                    overrides={overrides}
                    onSelect={onSelect}
                    onToggleExclude={onToggleExclude}
                    collapsed={collapsed}
                    onToggleCollapse={onToggleCollapse}
                />
            ))}
        </>
    );
}

export default function FigmaTreeManager({
    trees,
    selectedIdx,
    onSelectTree,
    selectedIds,
    excluded,
    overrides,
    onSelectNode,
    onToggleExclude,
}: Props) {
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const toggleCollapse = (id: string) =>
        setCollapsed((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    const tree = trees[selectedIdx];

    return (
        <div className={styles.manager}>
            <div className={styles.managerHeader}>
                <select
                    className={styles.sectionSelect}
                    value={selectedIdx}
                    onChange={(e) => onSelectTree(Number(e.target.value))}
                >
                    {trees.map((t, i) => (
                        <option key={t.id} value={i}>{t.name}</option>
                    ))}
                </select>
            </div>
            <div className={styles.treeScroll}>
                {tree && (
                    <TreeRow
                        n={tree}
                        depth={0}
                        selectedIds={selectedIds}
                        excluded={excluded}
                        overrides={overrides}
                        onSelect={onSelectNode}
                        onToggleExclude={onToggleExclude}
                        collapsed={collapsed}
                        onToggleCollapse={toggleCollapse}
                    />
                )}
            </div>
        </div>
    );
}
