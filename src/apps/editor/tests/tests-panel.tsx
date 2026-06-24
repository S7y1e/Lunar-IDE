import { VscChevronDown, VscPlay, VscBeaker, VscLoading } from "react-icons/vsc";
import { type useTestResults } from "./use-test-results";
import { type TestNode } from "../../../lib/project";
import styles from "./tests.module.scss";

type Props = {
    tests: ReturnType<typeof useTestResults>;
    onOpenAt: (file: string, line: number, column: number) => void;
    onOpenLocation: (dotPath: string, line: number) => void;
};

const ICON: Record<string, string> = {
    Success: "✓",
    Failure: "✗",
    Skipped: "○",
};

// Drop TestEZ-internal and plugin stack frames so only the user's code shows.
const INTERNAL = /_Index|testez|Lunar-Plugin|_Lunar\.rbxm/i;
const FRAME = /^([\w.]+):(\d+)/;

function parseError(err: string) {
    const lines = err.split("\n").map((l) => l.trim()).filter(Boolean);
    // The first line is the message, prefixed by a TestEZ-internal path:line —
    // strip that so only the human-readable assertion text remains.
    const message = (lines[0] ?? "").replace(/^[\w.]+:\d+:\s*/, "");
    const frames: { dotPath: string; line: number; raw: string }[] = [];
    for (const l of lines.slice(1)) {
        if (INTERNAL.test(l)) continue;
        const m = l.match(FRAME);
        if (m) frames.push({ dotPath: m[1], line: Number(m[2]), raw: l });
    }
    return { message, frames };
}

function Node({
    node,
    depth,
    onOpenLocation,
}: {
    node: TestNode;
    depth: number;
    onOpenLocation: (dotPath: string, line: number) => void;
}) {
    const cls = styles[node.status.toLowerCase()] ?? "";
    return (
        <>
            <div className={styles.row} style={{ paddingLeft: 12 + depth * 14 }}>
                <span className={`${styles.status} ${cls}`}>
                    {ICON[node.status] ?? "•"}
                </span>
                <span className={styles.phrase}>{node.phrase}</span>
            </div>
            {node.errors.map((e, i) => {
                const { message, frames } = parseError(e);
                return (
                    <div
                        key={i}
                        className={styles.errorBlock}
                        style={{ paddingLeft: 26 + depth * 14 }}
                    >
                        <div className={styles.errorMsg}>{message}</div>
                        {frames.map((f, j) => (
                            <button
                                key={j}
                                className={styles.frame}
                                onClick={() => onOpenLocation(f.dotPath, f.line)}
                                title={`Open ${f.dotPath}:${f.line}`}
                            >
                                {f.raw}
                            </button>
                        ))}
                    </div>
                );
            })}
            {node.children.map((c, i) => (
                <Node key={i} node={c} depth={depth + 1} onOpenLocation={onOpenLocation} />
            ))}
        </>
    );
}

export default function TestsPanel({ tests, onOpenAt, onOpenLocation }: Props) {
    const { results, running, configured, setupLog, busy, run, setup } = tests;
    const fail = results?.failureCount ?? 0;
    const pass = results?.successCount ?? 0;
    const skip = results?.skippedCount ?? 0;

    const onSetup = async () => {
        const spec = await setup();
        if (spec) onOpenAt(spec, 1, 1);
    };

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <span className={styles.title}>
                    <VscChevronDown size={14} />
                    Tests
                    {results && !results.error && (
                        <span className={styles.count}>
                            {pass}/{pass + fail + skip}
                        </span>
                    )}
                </span>
                {configured && (
                    <button
                        className={styles.headerBtn}
                        onClick={run}
                        disabled={running}
                        title="Run tests (TestEZ)"
                        aria-label="Run tests"
                    >
                        {running ? (
                            <VscLoading size={16} className={styles.spin} />
                        ) : (
                            <VscPlay size={16} />
                        )}
                    </button>
                )}
            </div>

            <div className={styles.body}>
                {!configured ? (
                    <div className={styles.onboard}>
                        <VscBeaker size={28} className={styles.emptyIcon} />
                        <p>
                            TestEZ runs your <code>*.spec.luau</code> tests inside
                            Studio (edit mode — no Play needed). Set it up and a
                            sample spec will be created.
                        </p>
                        <button className={styles.cta} onClick={onSetup} disabled={busy}>
                            {busy ? "Installing…" : "Set up TestEZ"}
                        </button>
                        {setupLog && <pre className={styles.log}>{setupLog}</pre>}
                    </div>
                ) : results?.error ? (
                    <div className={styles.empty}>{results.error}</div>
                ) : !results ? (
                    <div className={styles.empty}>
                        {running ? (
                            "Running tests in Studio…"
                        ) : (
                            <>
                                <VscBeaker size={28} className={styles.emptyIcon} />
                                Open Studio (synced), then press ▶ or run the
                                “Test: Run (TestEZ)” command.
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className={styles.summary}>
                            <span className={styles.success}>{pass} passed</span>
                            {fail > 0 && <span className={styles.failure}>{fail} failed</span>}
                            {skip > 0 && <span className={styles.skipped}>{skip} skipped</span>}
                        </div>
                        {(results.children ?? []).map((c, i) => (
                            <Node key={i} node={c} depth={0} onOpenLocation={onOpenLocation} />
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}
