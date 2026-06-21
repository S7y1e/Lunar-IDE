import { useMemo, useState, useRef } from "react";
import { VscClearAll, VscFilter, VscPlay, VscDebugStop } from "react-icons/vsc";
import { runtimeEnqueue } from "../../../lib/project";
import styles from "./runtime.module.scss";
import { RuntimeMessage } from "./use-runtime-bridge";
import RuntimeLine from "./runtime-line";
import ErrorCard from "./error-card";
import { groupMessages } from "./error-group";
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
    onEcho: (text: string) => void;
    root: string;
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
    onEcho,
    root,
}: Props) {
    const [hideNoise, setHideNoise] = useState(true);
    const [filter, setFilter] = useState("");
    const [evalInput, setEvalInput] = useState("");
    const evalRef = useRef<HTMLInputElement>(null);

    const submitEval = () => {
        const code = evalInput.trim();
        if (!code || !running) return;
        onEcho(`> ${code}`);
        runtimeEnqueue({ type: "eval", code }).catch(() => {});
        setEvalInput("");
    };

    const needle = filter.trim().toLowerCase();

    const filtered = useMemo(
        () =>
            messages.filter((m) => {
                if (hideNoise && isEngineNoise(m.text)) return false;
                if (needle && !m.text.toLowerCase().includes(needle)) return false;
                return true;
            }),
        [messages, hideNoise, needle],
    );

    const grouped = useMemo(() => groupMessages(filtered), [filtered]);
    const hidden = messages.length - filtered.length;

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

            <div className={styles.evalBar}>
                <span className={styles.evalPrompt}>&gt;</span>
                <input
                    ref={evalRef}
                    className={styles.evalInput}
                    value={evalInput}
                    placeholder={running ? "Lua expression…" : "Connect plugin to eval"}
                    disabled={!running}
                    spellCheck={false}
                    onChange={(e) => setEvalInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitEval()}
                />
            </div>

            <div className={styles.logs}>
                {messages.length === 0 ? (
                    <div className={styles.empty}>
                        No runtime output. Connect the Lunar Studio plugin and run a
                        play-test.
                    </div>
                ) : grouped.length === 0 ? (
                    <div className={styles.empty}>All {messages.length} lines hidden by filter.</div>
                ) : (
                    grouped.map((entry, i) =>
                        entry.kind === "error-group" ? (
                            <ErrorCard
                                key={i}
                                group={entry}
                                root={root}
                                resolve={resolve}
                                onOpen={onOpen}
                            />
                        ) : (
                            <div
                                key={i}
                                className={`${styles.logLine} ${styles[entry.type]}`}
                            >
                                <RuntimeLine
                                    text={entry.text}
                                    resolve={resolve}
                                    onOpen={onOpen}
                                />
                            </div>
                        ),
                    )
                )}
            </div>
        </div>
    );
}
