import { useEffect, useMemo, useState } from "react";
import { VscChevronDown, VscPlay, VscPulse } from "react-icons/vsc";
import { type RuntimeMessage } from "./use-runtime-bridge";
import { sendProfile, parseSamples, DONE } from "./profiler";
import styles from "./profiler.module.scss";

const DURATIONS = [3, 5, 10];

type Props = { messages: RuntimeMessage[] };

function Sparkline({ values }: { values: number[] }) {
    if (values.length < 2) return null;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const pts = values
        .map((v, i) => {
            const x = (i / (values.length - 1)) * 100;
            const y = 30 - ((v - min) / span) * 28 - 1;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    return (
        <svg className={styles.spark} viewBox="0 0 100 30" preserveAspectRatio="none">
            <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
    );
}

export default function ProfilerPanel({ messages }: Props) {
    const [seconds, setSeconds] = useState(5);
    const [sampling, setSampling] = useState(false);

    const lines = useMemo(() => messages.map((m) => m.text), [messages]);
    const samples = useMemo(() => parseSamples(lines), [lines]);

    // Clear the "sampling" state once the done marker arrives.
    useEffect(() => {
        if (lines.some((l) => l.includes(DONE))) setSampling(false);
    }, [lines]);

    const run = async () => {
        setSampling(true);
        try {
            await sendProfile(seconds);
        } catch {
            setSampling(false);
        }
        // safety: clear even if the done marker never arrives
        setTimeout(() => setSampling(false), (seconds + 2) * 1000);
    };

    const last = samples[samples.length - 1];
    const cats = last
        ? Object.entries(last.cats).sort((a, b) => b[1] - a[1]).slice(0, 12)
        : [];
    const maxCat = cats[0]?.[1] ?? 1;
    const memSeries = samples.map((s) => s.mem);
    const hbSeries = samples.map((s) => s.hb);

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <span className={styles.title}>
                    <VscChevronDown size={14} />
                    Profiler
                </span>
                <div className={styles.controls}>
                    <select
                        className={styles.select}
                        value={seconds}
                        onChange={(e) => setSeconds(Number(e.target.value))}
                        disabled={sampling}
                    >
                        {DURATIONS.map((d) => (
                            <option key={d} value={d}>
                                {d}s
                            </option>
                        ))}
                    </select>
                    <button
                        className={styles.sampleBtn}
                        onClick={run}
                        disabled={sampling}
                        title="Sample runtime stats from Studio"
                    >
                        <VscPlay size={13} />
                        {sampling ? "Sampling…" : "Sample"}
                    </button>
                </div>
            </div>

            <div className={styles.body}>
                {!last ? (
                    <div className={styles.empty}>
                        <VscPulse size={28} className={styles.emptyIcon} />
                        Sample memory & frame time from Studio via the bridge. Make sure the
                        Lunar plugin is connected, then press Sample.
                    </div>
                ) : (
                    <>
                        <div className={styles.stats}>
                            <div className={styles.stat}>
                                <span className={styles.statValue}>{last.mem.toFixed(1)}</span>
                                <span className={styles.statUnit}>MB total</span>
                                <span className={styles.statSpark}>
                                    <Sparkline values={memSeries} />
                                </span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statValue}>{last.hb.toFixed(2)}</span>
                                <span className={styles.statUnit}>ms heartbeat</span>
                                <span className={styles.statSpark}>
                                    <Sparkline values={hbSeries} />
                                </span>
                            </div>
                        </div>

                        <div className={styles.section}>Memory by category (MB)</div>
                        {cats.map(([name, v]) => (
                            <div key={name} className={styles.catRow}>
                                <span className={styles.catName} title={name}>
                                    {name}
                                </span>
                                <span className={styles.barTrack}>
                                    <span
                                        className={styles.barFill}
                                        style={{ width: `${(v / maxCat) * 100}%` }}
                                    />
                                </span>
                                <span className={styles.catVal}>{v.toFixed(1)}</span>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
