import { useContext, useEffect, useState } from "react";
import styles from "./file-tree.module.scss";
import shared from "../styles/shared.module.scss";
import { resolveFileIcon } from "../file-icons";
import { walkProjectFiles, type ProjectFile } from "../../../lib/filesystem";
import { TreeSelectionContext } from "./tree-selection";

// Subsequence (fuzzy) match against the relative path, like a command palette.
const fuzzy = (needle: string, hay: string): boolean => {
    let i = 0;
    for (const ch of hay) if (ch === needle[i] && ++i === needle.length) return true;
    return needle.length === 0;
};

type Props = { root: string; query: string };

export default function FilteredTree({ root, query }: Props) {
    const { selected, select, openFile } = useContext(TreeSelectionContext);
    const [files, setFiles] = useState<ProjectFile[]>([]);

    useEffect(() => {
        let active = true;
        walkProjectFiles(root)
            .then((f) => active && setFiles(f))
            .catch(() => {});
        return () => {
            active = false;
        };
    }, [root]);

    const q = query.toLowerCase();
    const results = files
        .filter((f) => fuzzy(q, f.relativePath.toLowerCase()))
        .slice(0, 200);

    if (results.length === 0)
        return <div className={styles.filterEmpty}>No matching files</div>;

    return (
        <>
            {results.map((f) => (
                <div
                    key={f.path}
                    className={`${styles.treeRow} ${selected === f.path ? styles.selected : ""}`}
                    style={{ paddingLeft: 8 }}
                    title={f.relativePath}
                    onClick={() => {
                        select(f.path);
                        openFile(f.path);
                    }}
                >
                    <span className={styles.chevronSpacer} />
                    <img
                        className={shared.nodeIcon}
                        src={resolveFileIcon({ name: f.name, path: f.path, isDir: false }, false)}
                        alt=""
                        draggable={false}
                    />
                    <span className={styles.nodeName}>{f.name}</span>
                    <span className={styles.filterPath}>{f.relativePath}</span>
                </div>
            ))}
        </>
    );
}
