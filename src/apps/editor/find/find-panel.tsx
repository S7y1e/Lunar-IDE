import { useMemo } from "react";
import { VscChevronDown, VscCaseSensitive } from "react-icons/vsc";
import { useProjectSearch } from "./use-project-search";
import { type SearchMatch } from "../../../lib/project";
import Highlight from "../search/highlight";
import styles from "./find.module.scss";

const baseName = (rel: string) => rel.split("/").pop() ?? rel;

type Props = {
    onOpenAt: (file: string, line: number, column: number) => void;
};

export default function FindPanel({ onOpenAt }: Props) {
    const { query, setQuery, caseSensitive, setCaseSensitive, results, loading } =
        useProjectSearch();

    const groups = useMemo(() => {
        const map = new Map<string, SearchMatch[]>();
        for (const match of results?.matches ?? []) {
            const list = map.get(match.file) ?? [];
            list.push(match);
            map.set(match.file, list);
        }
        return [...map.entries()];
    }, [results]);

    const total = results?.matches.length ?? 0;

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <span className={styles.title}>
                    <VscChevronDown size={14} />
                    Search
                </span>
            </div>

            <div className={styles.searchRow}>
                <input
                    className={styles.input}
                    value={query}
                    autoFocus
                    spellCheck={false}
                    placeholder="Search in project"
                    onChange={(e) => setQuery(e.target.value)}
                />
                <button
                    className={`${styles.toggle} ${caseSensitive ? styles.toggleOn : ""}`}
                    onClick={() => setCaseSensitive((v) => !v)}
                    title="Match case"
                    aria-pressed={caseSensitive}
                >
                    <VscCaseSensitive size={16} />
                </button>
            </div>

            <div className={styles.summary}>
                {query.trim() === ""
                    ? "Type to search across the project."
                    : loading
                      ? "Searching…"
                      : `${total} result${total === 1 ? "" : "s"} in ${groups.length} file${groups.length === 1 ? "" : "s"}${results?.truncated ? " (truncated)" : ""}`}
            </div>

            <div className={styles.body}>
                {groups.map(([file, matches]) => (
                    <div key={file} className={styles.group}>
                        <div className={styles.fileHead} title={file}>
                            <span className={styles.fileName}>{baseName(file)}</span>
                            <span className={styles.filePath}>{file}</span>
                            <span className={styles.count}>{matches.length}</span>
                        </div>
                        {matches.map((match, i) => (
                            <button
                                key={i}
                                className={styles.match}
                                onClick={() =>
                                    onOpenAt(match.file, match.line, match.column)
                                }
                                title={`${file}:${match.line}`}
                            >
                                <span className={styles.line}>{match.line}</span>
                                <span className={styles.preview}>
                                    <Highlight
                                        text={match.text.trim()}
                                        query={query.trim()}
                                    />
                                </span>
                            </button>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
