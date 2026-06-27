import { useState } from "react";
import {
    VscChevronDown,
    VscRefresh,
    VscCloudDownload,
    VscSync,
    VscTrash,
    VscAdd,
    VscPackage,
} from "react-icons/vsc";
import { usePackages } from "./use-packages";
import { useWallySearch } from "./use-wally-search";
import { packageAdd, packageRemove, type Package, type PackageKind } from "../../../lib/packages";
import { type WallyHit } from "../../../lib/wally-search";
import styles from "./packages.module.scss";

const KINDS: { id: PackageKind; label: string }[] = [
    { id: "shared", label: "Shared" },
    { id: "server", label: "Server" },
    { id: "dev", label: "Dev" },
];

type Props = { root: string };

export default function PackagesPanel({ root }: Props) {
    const pkgs = usePackages(root);
    const { list, busy, log } = pkgs;
    const [spec, setSpec] = useState("");
    const [kind, setKind] = useState<PackageKind>("shared");
    const [err, setErr] = useState<string | null>(null);
    const [focused, setFocused] = useState(false);
    const { hits, loading: searching } = useWallySearch(spec);
    const showHits = focused && (hits.length > 0 || searching);

    const pick = (h: WallyHit) => {
        setSpec(`${h.scope}/${h.name}@${h.versions[0] ?? ""}`);
        setFocused(false);
    };

    const add = async () => {
        if (!spec.trim()) return;
        setErr(null);
        try {
            await packageAdd(spec.trim(), kind);
            setSpec("");
            pkgs.refresh();
        } catch (e) {
            setErr(String(e));
        }
    };

    const remove = async (p: Package) => {
        try {
            await packageRemove(p.alias, p.kind);
            pkgs.refresh();
        } catch (e) {
            setErr(String(e));
        }
    };

    const row = (p: Package) => (
        <div key={`${p.kind}-${p.alias}`} className={styles.row}>
            <span className={styles.alias}>{p.alias}</span>
            <span className={styles.name}>{p.name}</span>
            <span className={styles.ver} title={`required ${p.versionReq}`}>
                {p.locked ?? p.versionReq}
            </span>
            <button className={styles.iconBtn} title="Remove" onClick={() => remove(p)}>
                <VscTrash size={14} />
            </button>
        </div>
    );

    return (
        <div className={styles.sidebar}>
            <div className={styles.header}>
                <span className={styles.title}>
                    <VscChevronDown size={14} />
                    Packages
                    {list && <span className={styles.count}>{list.packages.length}</span>}
                </span>
                <div className={styles.actions}>
                    <button
                        className={styles.headerBtn}
                        onClick={pkgs.install}
                        disabled={busy}
                        title="wally install"
                    >
                        <VscCloudDownload size={15} />
                    </button>
                    <button
                        className={styles.headerBtn}
                        onClick={pkgs.update}
                        disabled={busy}
                        title="wally update"
                    >
                        <VscSync size={15} />
                    </button>
                    <button className={styles.headerBtn} onClick={pkgs.refresh} title="Refresh">
                        <VscRefresh size={15} />
                    </button>
                </div>
            </div>

            {list?.hasWally && (
                <div className={styles.addRow}>
                    <div className={styles.inputWrap}>
                        <input
                            className={styles.input}
                            placeholder="search or scope/name@version"
                            value={spec}
                            onChange={(e) => setSpec(e.target.value)}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setTimeout(() => setFocused(false), 150)}
                            onKeyDown={(e) => e.key === "Enter" && add()}
                        />
                        {showHits && (
                            <div className={styles.hits}>
                                {hits.length === 0 && searching ? (
                                    <div className={styles.hitEmpty}>Searching…</div>
                                ) : (
                                    hits.slice(0, 8).map((h) => (
                                        <button
                                            key={`${h.scope}/${h.name}`}
                                            className={styles.hit}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => pick(h)}
                                        >
                                            <span className={styles.hitName}>
                                                {h.scope}/{h.name}
                                            </span>
                                            <span className={styles.hitVer}>
                                                {h.versions[0]}
                                            </span>
                                            {h.description && (
                                                <span className={styles.hitDesc}>
                                                    {h.description}
                                                </span>
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                    <select
                        className={styles.select}
                        value={kind}
                        onChange={(e) => setKind(e.target.value as PackageKind)}
                    >
                        {KINDS.map((k) => (
                            <option key={k.id} value={k.id}>
                                {k.label}
                            </option>
                        ))}
                    </select>
                    <button className={styles.iconBtn} title="Add" onClick={add}>
                        <VscAdd size={14} />
                    </button>
                </div>
            )}

            {err && <div className={styles.err}>{err}</div>}

            <div className={styles.body}>
                {!list?.hasWally ? (
                    <div className={styles.empty}>
                        <VscPackage size={28} className={styles.emptyIcon} />
                        No wally.toml in this project. Run <code>wally init</code> to start
                        managing packages.
                    </div>
                ) : list.packages.length === 0 ? (
                    <div className={styles.empty}>No dependencies yet.</div>
                ) : (
                    KINDS.map((k) => {
                        const items = list.packages.filter((p) => p.kind === k.id);
                        if (items.length === 0) return null;
                        return (
                            <div key={k.id}>
                                <div className={styles.section}>
                                    {k.label} ({items.length})
                                </div>
                                {items.map(row)}
                            </div>
                        );
                    })
                )}
            </div>

            {log && <pre className={styles.log}>{log}</pre>}
        </div>
    );
}
