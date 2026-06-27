import { VscChevronDown, VscRefresh, VscLightbulb, VscWand } from "react-icons/vsc";
import { type useInsights } from "./use-insights";
import { fixFor, applyDiskFix } from "./fixes";
import { type InsightFinding } from "../../../lib/project";
import styles from "./insights.module.scss";

const dirOf = (rel: string) => {
    const i = rel.lastIndexOf("/");
    return i < 0 ? "" : rel.slice(0, i);
};

const CATEGORIES: { id: string; label: string }[] = [
    { id: "orphan", label: "Orphan modules" },
    { id: "unused-require", label: "Unused requires" },
    { id: "cycle", label: "Require cycles" },
    { id: "layer", label: "Layer violations" },
    { id: "dangling-event", label: "Dangling events" },
    { id: "unresolved", label: "Unresolved requires" },
];

type Props = {
    insights: ReturnType<typeof useInsights>;
    onOpenAt: (file: string, line: number, column: number) => void;
};

export default function InsightsPanel({ insights, onOpenAt }: Props) {
    const { insights: data, loading, refresh } = insights;
    const findings = data?.findings ?? [];

    const groups = CATEGORIES.map((c) => ({
        ...c,
        items: findings.filter((f) => f.category === c.id),
    })).filter((g) => g.items.length > 0);

    const fixAndRefresh = async (f: InsightFinding) => {
        try {
            await applyDiskFix(f);
            refresh();
        } catch {
            /* surfaced by the fs-watch refresh anyway */
        }
    };

    const row = (f: InsightFinding, i: number) => {
        const fix = fixFor(f.category);
        return (
            <div key={`${f.file}-${i}`} className={styles.row}>
                <button
                    className={styles.rowMain}
                    onClick={() => onOpenAt(f.file, f.line, 0)}
                    title={`${f.file}:${f.line}`}
                >
                    <span className={`${styles.dot} ${styles[f.severity] ?? ""}`} />
                    <span className={styles.message}>{f.message}</span>
                    <span className={styles.path}>{dirOf(f.file)}</span>
                </button>
                {fix && (
                    <button
                        className={styles.fixBtn}
                        title={fix.label}
                        onClick={() => fixAndRefresh(f)}
                    >
                        <VscWand size={13} />
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <span className={styles.title}>
                    <VscChevronDown size={14} />
                    Insights
                    {findings.length > 0 && (
                        <span className={styles.count}>{findings.length}</span>
                    )}
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

            <div className={styles.body}>
                {findings.length === 0 ? (
                    <div className={styles.empty}>
                        {loading ? (
                            "Analyzing project…"
                        ) : (
                            <>
                                <VscLightbulb size={28} className={styles.emptyIcon} />
                                No issues found — orphan modules, require cycles, layer
                                violations and dangling events will show up here.
                            </>
                        )}
                    </div>
                ) : (
                    groups.map((g) => (
                        <div key={g.id}>
                            <div className={styles.section}>
                                {g.label} ({g.items.length})
                            </div>
                            {g.items.map(row)}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
