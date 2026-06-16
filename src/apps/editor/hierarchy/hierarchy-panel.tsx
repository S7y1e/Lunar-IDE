import { useMemo, useState } from "react";
import {
    VscChevronDown,
    VscRefresh,
    VscArrowRight,
    VscArrowLeft,
} from "react-icons/vsc";
import { join } from "@tauri-apps/api/path";
import { useDependencies } from "../dependencies/use-dependencies";
import { toRelative } from "../data-model/instance-path";
import HierarchyNode from "./hierarchy-node";
import styles from "./hierarchy.module.scss";

type Mode = "requires" | "requiredBy";

type Props = {
    root: string;
    activeFile: string | null;
    onOpenFile: (absPath: string) => void;
};

export default function HierarchyPanel({ root, activeFile, onOpenFile }: Props) {
    const { graph, loading, refresh } = useDependencies(root);
    const rel = activeFile ? toRelative(root, activeFile) : null;
    const [mode, setMode] = useState<Mode>("requires");

    const childrenOf = useMemo(() => {
        const edges = graph?.edges ?? [];
        return (node: string) =>
            mode === "requires"
                ? edges.filter((e) => e.from === node).map((e) => e.to)
                : edges.filter((e) => e.to === node).map((e) => e.from);
    }, [graph, mode]);

    const open = async (relFile: string) =>
        onOpenFile(await join(root, ...relFile.split("/")));

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <span className={styles.title}>
                    <VscChevronDown size={14} />
                    Hierarchy
                </span>
                <button
                    className={styles.headerBtn}
                    onClick={refresh}
                    title="Refresh"
                    aria-label="Refresh"
                >
                    <VscRefresh size={16} />
                </button>
            </div>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${mode === "requires" ? styles.tabActive : ""}`}
                    onClick={() => setMode("requires")}
                >
                    <VscArrowRight size={12} /> Requires
                </button>
                <button
                    className={`${styles.tab} ${mode === "requiredBy" ? styles.tabActive : ""}`}
                    onClick={() => setMode("requiredBy")}
                >
                    <VscArrowLeft size={12} /> Required by
                </button>
            </div>

            <div className={styles.body}>
                {!rel ? (
                    <div className={styles.empty}>
                        {loading
                            ? "Loading…"
                            : "Open a module to see its require hierarchy."}
                    </div>
                ) : (
                    <HierarchyNode
                        key={`${rel}:${mode}`}
                        node={rel}
                        childrenOf={childrenOf}
                        ancestors={new Set()}
                        depth={0}
                        onOpen={open}
                    />
                )}
            </div>
        </div>
    );
}
