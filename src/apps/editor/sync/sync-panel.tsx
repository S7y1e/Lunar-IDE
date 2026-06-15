import { VscPlay, VscDebugStop } from "react-icons/vsc";
import styles from "./sync.module.scss";
import { SyncStatus, SyncBackend, ConnectionPhase } from "./use-sync-server";

type Props = {
    backend: SyncBackend;
    onBackendChange: (backend: SyncBackend) => void;
    status: SyncStatus;
    phase: ConnectionPhase;
    logs: string[];
    port: number;
    onPortChange: (port: number) => void;
    onStart: () => void;
    onStop: () => void;
};

const STATUS_LABEL: Record<SyncStatus, string> = {
    stopped: "Stopped",
    running: "Running",
    error: "Error",
};

function chip(phase: ConnectionPhase): { label: string; tone: string } {
    switch (phase) {
        case "serving":
            return { label: "Serving", tone: "running" };
        case "error":
            return { label: "Connection error", tone: "error" };
        default:
            return { label: "Starting…", tone: "warning" };
    }
}

export default function SyncPanel({
    backend,
    onBackendChange,
    status,
    phase,
    logs,
    port,
    onPortChange,
    onStart,
    onStop,
}: Props) {
    const running = status === "running";
    const conn = chip(phase);

    return (
        <div className={styles.sync}>
            <div className={styles.header}>
                <span className={styles.title}>Sync</span>
                <span className={styles.statusRow}>
                    {running && (
                        <span className={`${styles.chip} ${styles[conn.tone]}`}>
                            {conn.label}
                        </span>
                    )}
                    <span className={`${styles.dot} ${styles[status]}`} />
                    {STATUS_LABEL[status]}
                </span>
            </div>

            <div className={styles.body}>
                <label className={styles.field}>
                    <span className={styles.fieldLabel}>Backend</span>
                    <select
                        className={styles.select}
                        value={backend}
                        disabled={running}
                        onChange={(e) =>
                            onBackendChange(e.target.value as SyncBackend)
                        }
                    >
                        <option value="rojo">Rojo</option>
                        <option value="argon">Argon (two-way)</option>
                    </select>
                </label>

                <label className={styles.field}>
                    <span className={styles.fieldLabel}>Port</span>
                    <input
                        type="number"
                        className={styles.input}
                        value={port}
                        disabled={running}
                        onChange={(e) => onPortChange(e.target.valueAsNumber || 0)}
                    />
                </label>

                <button
                    className={`${styles.action} ${running ? styles.stop : styles.start}`}
                    onClick={running ? onStop : onStart}
                >
                    {running ? <VscDebugStop size={16} /> : <VscPlay size={16} />}
                    {running ? "Stop sync" : "Start sync"}
                </button>
            </div>

            <div className={styles.logs}>
                {logs.length === 0 ? (
                    <div className={styles.empty}>No output yet.</div>
                ) : (
                    logs.map((line, i) => (
                        <div key={i} className={styles.logLine}>
                            {line}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
