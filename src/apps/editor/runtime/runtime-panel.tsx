import { useState } from "react";
import { VscClearAll, VscFilter, VscPlay, VscDebugStop } from "react-icons/vsc";
import styles from "./runtime.module.scss";
import { RuntimeMessage } from "./use-runtime-bridge";
import RuntimeLine from "./runtime-line";
import { isEngineNoise } from "./runtime-filter";

type Props = {
    messages: RuntimeMessage[];
    running: boolean;
    port: number;
    playtest: boolean;
    onClear: () => void;
    onPlay: (stop: boolean) => void;
    resolve: (dotPath: string) => string | null;
    onOpen: (dotPath: string, line: number) => void;
};

export default function RuntimePanel({
    messages,
    running,
    port,
    playtest,
    onClear,
    onPlay,
    resolve,
    onOpen,
}: Props) {
    const [hideNoise, setHideNoise] = useState(true);
    const [filter, setFilter] = useState("");

    const needle = filter.trim().toLowerCase();
    const visible = messages.filter((m) => {
        if (hideNoise && isEngineNoise(m.text)) return false;
        if (needle && !m.text.toLowerCase().includes(needle)) return false;
        return true;
    });
    const hidden = messages.length - visible.length;

    return (
        <div className={styles.runtime}>
            <div className={styles.header}>
                <span className={styles.title}>Runtime</span>
                <span className={styles.statusRow}>
                    <button
                        className={`${styles.playBtn} ${playtest ? styles.stopBtn : ""}`}
                        onClick={() => onPlay(playtest)}
                        title={
                            playtest
                                ? "Stop play-test (Shift+F5)"
                                : "Play-test in Studio (F5, then focus returns here)"
                        }
                    >
                        {playtest ? <VscDebugStop size={13} /> : <VscPlay size={13} />}
                        {playtest ? "Stop" : "Play"}
                    </button>
                    <span className={`${styles.chip} ${running ? styles.on : styles.off}`}>
                        {running ? `Listening · :${port}` : "Offline"}
                    </span>
                    <button className={styles.clear} onClick={onClear} title="Clear output">
                        <VscClearAll size={14} />
                    </button>
                </span>
            </div>

            <div className={styles.filterBar}>
                <input
                    className={styles.filterInput}
                    placeholder="Filter output…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
                <button
                    className={`${styles.filterToggle} ${hideNoise ? styles.active : ""}`}
                    onClick={() => setHideNoise((v) => !v)}
                    title="Hide engine noise (asset errors, etc.)"
                >
                    <VscFilter size={13} />
                    Noise
                </button>
                {hidden > 0 && <span className={styles.hiddenCount}>{hidden} hidden</span>}
            </div>

            <div className={styles.logs}>
                {messages.length === 0 ? (
                    <div className={styles.empty}>
                        No runtime output. Connect the Lunar Studio plugin and run a
                        play-test.
                    </div>
                ) : visible.length === 0 ? (
                    <div className={styles.empty}>All {messages.length} lines hidden by filter.</div>
                ) : (
                    visible.map((message, i) => (
                        <div key={i} className={`${styles.logLine} ${styles[message.type]}`}>
                            <RuntimeLine text={message.text} resolve={resolve} onOpen={onOpen} />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
