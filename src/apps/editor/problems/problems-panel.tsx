import { useSyncExternalStore } from "react";
import { VscError, VscWarning } from "react-icons/vsc";
import {
    subscribeDiagnostics,
    diagnosticsVersion,
    getDiagnostics,
} from "../code-editor/luau-lsp/diagnostics-store";
import { uriToPath } from "../code-editor/luau-lsp/uri";
import { toRelative } from "../data-model/instance-path";
import styles from "./problems.module.scss";

const baseName = (rel: string) => rel.split("/").pop() ?? rel;

type Props = {
    root: string;
    onOpenAt: (file: string, line: number, column: number) => void;
};

export default function ProblemsPanel({ root, onOpenAt }: Props) {
    useSyncExternalStore(subscribeDiagnostics, diagnosticsVersion);

    const files = [...getDiagnostics().entries()]
        .map(([uri, diags]) => ({ rel: toRelative(root, uriToPath(uri)), diags }))
        .filter((f) => f.diags.length > 0)
        .sort((a, b) => a.rel.localeCompare(b.rel));

    const total = files.reduce((n, f) => n + f.diags.length, 0);

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <VscWarning size={14} />
                <span>Problems</span>
                {total > 0 && <span className={styles.count}>{total}</span>}
            </div>

            {total === 0 ? (
                <div className={styles.empty}>
                    No problems detected. luau-lsp diagnostics for open files show up
                    here.
                </div>
            ) : (
                <div className={styles.body}>
                    {files.map((f) => (
                        <div key={f.rel} className={styles.group}>
                            <div className={styles.fileHead} title={f.rel}>
                                <span className={styles.fileName}>{baseName(f.rel)}</span>
                                <span className={styles.filePath}>{f.rel}</span>
                                <span className={styles.fileCount}>{f.diags.length}</span>
                            </div>
                            {f.diags.map((d, i) => (
                                <button
                                    key={i}
                                    className={styles.row}
                                    onClick={() =>
                                        onOpenAt(
                                            f.rel,
                                            d.range.start.line + 1,
                                            d.range.start.character + 1,
                                        )
                                    }
                                    title={`${f.rel}:${d.range.start.line + 1}`}
                                >
                                    {(d.severity ?? 1) === 1 ? (
                                        <VscError className={styles.iconError} />
                                    ) : (
                                        <VscWarning className={styles.iconWarn} />
                                    )}
                                    <span className={styles.lineNum}>
                                        {d.range.start.line + 1}
                                    </span>
                                    <span className={styles.message}>{d.message}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
