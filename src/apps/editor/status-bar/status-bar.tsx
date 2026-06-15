import { IoSyncOutline } from "react-icons/io5";
import styles from "./status-bar.module.scss";
import { SyncStatus, SyncBackend, ConnectionPhase } from "../sync/use-sync-server";
import { useProject } from "../../../lib/project";

type CursorPosition = { line: number; column: number };

type Props = {
    status: SyncStatus;
    backend: SyncBackend;
    phase: ConnectionPhase;
    port: number;
    cursor: CursorPosition | null;
    onClick: () => void;
};

const BACKEND_LABEL: Record<SyncBackend, string> = {
    rojo: "Rojo",
    argon: "Argon",
};

export default function StatusBar({
    status,
    backend,
    phase,
    port,
    cursor,
    onClick,
}: Props) {
    const project = useProject();

    let label = "Sync stopped";
    let tone = "stopped";
    let title = "Open Sync panel";

    if (status === "error" || phase === "error") {
        label = "Sync error";
        tone = "error";
    } else if (status === "running") {
        const base = `${BACKEND_LABEL[backend]} · :${port}`;
        if (phase === "serving") {
            label = base;
            tone = "running";
            title = `${BACKEND_LABEL[backend]} serving on port ${port}`;
        } else {
            label = `${base} · starting`;
            tone = "warning";
            title = `${BACKEND_LABEL[backend]} starting on port ${port}`;
        }
    }

    return (
        <footer className={styles.statusBar}>
            {project && (
                <span className={styles.project} title={project.root}>
                    {project.name}
                </span>
            )}
            <button
                className={`${styles.item} ${styles[tone]}`}
                onClick={onClick}
                title={title}
            >
                <IoSyncOutline
                    size={13}
                    className={status === "running" ? styles.spin : undefined}
                />
                <span>{label}</span>
            </button>

            {cursor && (
                <span className={styles.cursor}>
                    Ln {cursor.line}, Col {cursor.column}
                </span>
            )}
        </footer>
    );
}
