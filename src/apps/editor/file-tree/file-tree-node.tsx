import { useContext, useEffect, useRef, type MouseEvent } from "react";
import { VscChevronRight } from "react-icons/vsc";
import { FileNode } from "../../../lib/filesystem";
import { canonicalPath } from "../code-editor/luau-lsp/uri";
import styles from "./file-tree.module.scss";
import shared from "../styles/shared.module.scss";
import { resolveFileIcon } from "../file-icons";
import ContextMenu from "./context-menu";
import { TreeSelectionContext } from "./tree-selection";
import NameInput from "./name-input";
import { useTreeNode } from "./use-tree-node";

type Props = {
    node: FileNode;
    depth?: number;
    defaultExpanded?: boolean;
    onChanged?: () => void;
};

export default function FileTreeNode({
    node,
    depth = 0,
    defaultExpanded = false,
    onChanged,
}: Props) {
    const { selected, select, openFile, renameNode, revealPath } =
        useContext(TreeSelectionContext);
    const {
        expanded,
        children,
        menu,
        renaming,
        creating,
        setMenu,
        setRenaming,
        setCreating,
        toggle,
        expand,
        reload,
        submitCreate,
        submitRename,
        menuItems,
    } = useTreeNode({ node, defaultExpanded, onChanged, renameNode });

    const rowRef = useRef<HTMLDivElement>(null);

    // Auto-reveal the active editor file: ancestor folders expand on the way
    // down (each expansion mounts children, cascading the effect), and the
    // matching leaf scrolls into view and highlights.
    useEffect(() => {
        if (!revealPath) return;
        const here = canonicalPath(node.path);
        if (node.isDir) {
            if (revealPath.startsWith(here + "\\")) expand();
        } else if (here === revealPath) {
            select(node.path);
            rowRef.current?.scrollIntoView({ block: "nearest" });
        }
        // Only on reveal target change — not on `expanded`, or collapsing a
        // folder that holds the active file would instantly re-expand it.
        // The cascade works via children mounting (each runs this on mount).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revealPath]);

    const handleClick = () => {
        select(node.path);
        toggle();
    };

    const handleDoubleClick = () => {
        if (!node.isDir) openFile(node.path);
    };

    const openMenu = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
    };

    return (
        <div>
            <div
                ref={rowRef}
                className={`${styles.treeRow} ${selected === node.path ? styles.selected : ""}`}
                style={{ paddingLeft: depth * 12 + 8 }}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onContextMenu={openMenu}
            >
                {node.isDir ? (
                    <VscChevronRight
                        className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
                    />
                ) : (
                    <span className={styles.chevronSpacer} />
                )}

                <img
                    className={shared.nodeIcon}
                    src={resolveFileIcon(node, expanded)}
                    alt=""
                    draggable={false}
                />

                {renaming ? (
                    <NameInput
                        initial={node.name}
                        onSubmit={submitRename}
                        onCancel={() => setRenaming(false)}
                    />
                ) : (
                    <>
                        <span className={styles.nodeName}>{node.name}</span>
                        {depth === 0 && (
                            <span className={styles.rootPath}>{node.path}</span>
                        )}
                    </>
                )}
            </div>

            {expanded && (
                <>
                    {creating && (
                        <div
                            className={styles.treeRow}
                            style={{ paddingLeft: (depth + 1) * 12 + 8 }}
                        >
                            <span className={styles.chevronSpacer} />
                            <img
                                className={shared.nodeIcon}
                                src={resolveFileIcon(
                                    { name: "", path: "", isDir: creating === "folder" },
                                    false
                                )}
                                alt=""
                                draggable={false}
                            />
                            <NameInput
                                initial=""
                                onSubmit={submitCreate}
                                onCancel={() => setCreating(null)}
                            />
                        </div>
                    )}

                    {children.map((child) => (
                        <FileTreeNode
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            onChanged={reload}
                        />
                    ))}
                </>
            )}

            {menu && (
                <ContextMenu
                    x={menu.x}
                    y={menu.y}
                    items={menuItems}
                    onClose={() => setMenu(null)}
                />
            )}
        </div>
    );
}
