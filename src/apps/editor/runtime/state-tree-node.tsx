import { VscChevronRight } from "react-icons/vsc";
import { type ChangeKind, type JsonValue } from "./state-diff";
import styles from "./state.module.scss";

const isObj = (v: JsonValue): v is { [k: string]: JsonValue } =>
    typeof v === "object" && v !== null && !Array.isArray(v);

const branch = (v: JsonValue) => Array.isArray(v) || isObj(v);

const entries = (v: JsonValue): [string, JsonValue][] => {
    if (Array.isArray(v)) return v.map((x, i) => [String(i), x]);
    if (isObj(v)) return Object.keys(v).map((k) => [k, v[k]]);
    return [];
};

const preview = (v: JsonValue): string => {
    if (Array.isArray(v)) return `[${v.length}]`;
    if (isObj(v)) return `{${Object.keys(v).length}}`;
    if (typeof v === "string") return `"${v}"`;
    return String(v);
};

const valueClass = (v: JsonValue): string => {
    if (typeof v === "number") return styles.num;
    if (typeof v === "string") return styles.str;
    if (typeof v === "boolean" || v === null) return styles.lit;
    return "";
};

type Props = {
    label: string;
    value: JsonValue;
    path: string;
    depth: number;
    seq: number;
    changes: Map<string, ChangeKind>;
    expanded: Set<string>;
    onToggle: (path: string) => void;
};

export default function StateTreeNode({
    label,
    value,
    path,
    depth,
    seq,
    changes,
    expanded,
    onToggle,
}: Props) {
    const open = expanded.has(path);
    const hasChildren = branch(value) && entries(value).length > 0;
    const kind = changes.get(path);

    return (
        <div>
            <div
                className={styles.row}
                onClick={() => hasChildren && onToggle(path)}
            >
                {kind && <span key={seq} className={`${styles.flash} ${styles[kind]}`} />}
                <span className={styles.indent} style={{ width: depth * 12 }} />
                {hasChildren ? (
                    <VscChevronRight
                        className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
                    />
                ) : (
                    <span className={styles.chevronSpacer} />
                )}
                <span className={styles.key}>{label}</span>
                <span className={`${styles.value} ${branch(value) ? "" : valueClass(value)}`}>
                    {preview(value)}
                </span>
            </div>

            {open &&
                hasChildren &&
                entries(value).map(([k, child]) => (
                    <StateTreeNode
                        key={k}
                        label={k}
                        value={child}
                        path={path ? `${path}.${k}` : k}
                        depth={depth + 1}
                        seq={seq}
                        changes={changes}
                        expanded={expanded}
                        onToggle={onToggle}
                    />
                ))}
        </div>
    );
}
