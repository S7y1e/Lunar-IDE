import { useState } from "react";
import { FaFigma } from "react-icons/fa";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { fetchFrame, parseFigmaUrl } from "./figma-client";
import { mapFigma } from "./map-figma";
import type { UiNode } from "./figma-types";
import styles from "./figma.module.scss";

const URL_KEY = "figma.url";
const TOKEN_KEY = "figma.token";

function Row({ node, depth }: { node: UiNode; depth: number }) {
    const { w, h } = node.size;
    return (
        <>
            <div className={styles.row} style={{ paddingLeft: 12 + depth * 14 }}>
                <span className={styles.cls} data-cls={node.className}>
                    {node.className}
                </span>
                <span className={styles.name}>{node.name}</span>
                <span className={styles.dims}>
                    {w}×{h}
                </span>
            </div>
            {node.children.map((c) => (
                <Row key={c.id} node={c} depth={depth + 1} />
            ))}
        </>
    );
}

export default function FigmaPanel() {
    const [url, setUrl] = useState(() => localStorage.getItem(URL_KEY) ?? "");
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
    const [tree, setTree] = useState<UiNode | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setError(null);
        setLoading(true);
        try {
            const { fileKey, nodeId } = parseFigmaUrl(url.trim());
            localStorage.setItem(URL_KEY, url.trim());
            localStorage.setItem(TOKEN_KEY, token.trim());
            const doc = await fetchFrame(fileKey, nodeId, token.trim(), tauriFetch as typeof fetch);
            setTree(mapFigma(doc));
        } catch (e) {
            setTree(null);
            setError(String(e instanceof Error ? e.message : e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <FaFigma size={13} />
                <span>Figma</span>
            </div>

            <div className={styles.form}>
                <input
                    className={styles.input}
                    placeholder="Figma frame URL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    spellCheck={false}
                />
                <input
                    className={styles.input}
                    type="password"
                    placeholder="Personal access token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    spellCheck={false}
                />
                <button
                    className={styles.load}
                    onClick={load}
                    disabled={loading || !url.trim() || !token.trim()}
                >
                    {loading ? "Loading…" : "Load"}
                </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {tree ? (
                <div className={styles.body}>
                    <Row node={tree} depth={0} />
                </div>
            ) : (
                !error && <div className={styles.empty}>Paste a frame URL and token, then Load.</div>
            )}
        </div>
    );
}
