import { useMemo } from "react";
import { type GitCommit } from "../../../lib/git";
import { laneColor, layoutGraph } from "./lane-layout";
import styles from "./git.module.scss";

const COLW = 46;
const LANEH = 40;
const PADX = 28;
const PADY = 26;
const R = 6;

type Props = {
    commits: GitCommit[];
    selected: string | null;
    onSelect: (hash: string) => void;
};

export default function GitGraph({ commits, selected, onSelect }: Props) {
    const g = useMemo(() => layoutGraph(commits), [commits]);
    if (commits.length === 0) return <div className={styles.empty}>No commits</div>;

    // Oldest on the left, newest on the right (col 0 = newest).
    const xOf = (col: number) => PADX + (g.cols - 1 - col) * COLW;
    const yOf = (lane: number) => PADY + lane * LANEH;
    const width = PADX * 2 + g.cols * COLW;
    const height = PADY * 2 + g.lanes * LANEH;

    return (
        <div className={styles.graphScroll}>
            <svg width={width} height={height} className={styles.graph}>
                {g.edges.map((e, i) => {
                    const x1 = xOf(e.fromCol);
                    const y1 = yOf(e.fromLane);
                    const x2 = xOf(e.toCol);
                    const y2 = yOf(e.toLane);
                    const mx = (x1 + x2) / 2;
                    return (
                        <path
                            key={i}
                            d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                            fill="none"
                            stroke={laneColor(e.lane)}
                            strokeWidth={2}
                            opacity={0.85}
                        />
                    );
                })}
                {g.nodes.map((n) => {
                    const x = xOf(n.col);
                    const y = yOf(n.lane);
                    const active = n.commit.hash === selected;
                    return (
                        <g
                            key={n.commit.hash}
                            className={styles.nodeG}
                            onClick={() => onSelect(n.commit.hash)}
                        >
                            <title>
                                {n.commit.short} · {n.commit.subject}
                            </title>
                            <circle
                                cx={x}
                                cy={y}
                                r={active ? R + 2 : R}
                                fill={laneColor(n.lane)}
                                stroke={active ? "var(--text)" : "var(--bg-window)"}
                                strokeWidth={2}
                            />
                            {n.commit.refs.slice(0, 2).map((ref, ri) => (
                                <g key={ref} transform={`translate(${x}, ${y - 13 - ri * 14})`}>
                                    <rect
                                        x={-2}
                                        y={-9}
                                        width={ref.length * 6.2 + 8}
                                        height={13}
                                        rx={3}
                                        className={styles.refChip}
                                    />
                                    <text x={2} y={1} className={styles.refText}>
                                        {ref}
                                    </text>
                                </g>
                            ))}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
