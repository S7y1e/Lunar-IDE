import { useEffect, useState } from "react";
import { join } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { searchProject, type SearchResults } from "../../../lib/project";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function useProjectSearch(root: string) {
    const [query, setQuery] = useState("");
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [results, setResults] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(false);
    // Bumped to force a re-search (e.g. after a replace rewrote files).
    const [nonce, setNonce] = useState(0);

    useEffect(() => {
        const q = query.trim();
        if (!q) {
            setResults(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        const timer = setTimeout(() => {
            searchProject(q, caseSensitive)
                .then((r) => setResults(r))
                .catch(() => setResults(null))
                .finally(() => setLoading(false));
        }, 200);
        return () => clearTimeout(timer);
    }, [query, caseSensitive, nonce]);

    // Replace every occurrence of the query in the files that matched, then
    // re-search. Returns how many occurrences were replaced.
    const replaceAll = async (replacement: string): Promise<number> => {
        const q = query.trim();
        if (!q || !results) return 0;
        const files = [...new Set(results.matches.map((m) => m.file))];
        const re = new RegExp(escape(q), caseSensitive ? "g" : "gi");
        let count = 0;
        for (const file of files) {
            const abs = await join(root, ...file.split("/"));
            try {
                const text = await readTextFile(abs);
                const hits = text.match(re);
                if (!hits) continue;
                count += hits.length;
                await writeTextFile(abs, text.replace(re, replacement));
            } catch {
                // skip files we can't read/write
            }
        }
        setNonce((n) => n + 1);
        return count;
    };

    return {
        query,
        setQuery,
        caseSensitive,
        setCaseSensitive,
        results,
        loading,
        replaceAll,
    };
}
