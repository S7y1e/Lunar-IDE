import { useEffect, useState } from "react";
import { searchProject, type SearchResults } from "../../../lib/project";

export function useProjectSearch() {
    const [query, setQuery] = useState("");
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [results, setResults] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = query.trim();
        if (!q) {
            setResults(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        // Debounce so we don't search the whole project on every keystroke.
        const timer = setTimeout(() => {
            searchProject(q, caseSensitive)
                .then((r) => setResults(r))
                .catch(() => setResults(null))
                .finally(() => setLoading(false));
        }, 200);
        return () => clearTimeout(timer);
    }, [query, caseSensitive]);

    return { query, setQuery, caseSensitive, setCaseSensitive, results, loading };
}
