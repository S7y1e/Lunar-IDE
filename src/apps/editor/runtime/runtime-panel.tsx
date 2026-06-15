import { VscClearAll } from "react-icons/vsc";
import styles from "./runtime.module.scss";
import { RuntimeMessage } from "./use-runtime-bridge";

type Props = {
    messages: RuntimeMessage[];
    running: boolean;
    port: number;
    onClear: () => void;
};

export default function RuntimePanel({ messages, running, port, onClear }: Props) {
    return (
        <div className={styles.runtime}>
            <div className={styles.header}>
                <span className={styles.title}>Runtime</span>
                <span className={styles.statusRow}>
                    <span
                        className={`${styles.chip} ${running ? styles.on : styles.off}`}
                    >
                        {running ? `Listening · :${port}` : "Offline"}
                    </span>
                    <button
                        className={styles.clear}
                        onClick={onClear}
                        title="Clear output"
                    >
                        <VscClearAll size={14} />
                    </button>
                </span>
            </div>

            <div className={styles.logs}>
                {messages.length === 0 ? (
                    <div className={styles.empty}>
                        No runtime output. Connect the Lunar Studio plugin and run a
                        play-test.
                    </div>
                ) : (
                    messages.map((message, i) => (
                        <div
                            key={i}
                            className={`${styles.logLine} ${styles[message.type]}`}
                        >
                            {message.text}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
