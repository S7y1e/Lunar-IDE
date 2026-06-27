import { useEffect, useState } from "react";
import { searchWally, type WallyHit } from "../../../lib/wally-search";

// Debounced Wally registry search. Idle while the query is empty, too short, or
// already pinned to a version (contains "@").
export function useWallySearch(query: string) {
    const [hits, setHits] = useState<WallyHit[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = query.trim();
        if (q.includes("@") || q.length < 2) {
            setHits([]);
            return;
        }
        let active = true;
        setLoading(true);
        const id = setTimeout(() => {
            searchWally(q)
                .then((r) => active && setHits(r))
                .catch(() => active && setHits([]))
                .finally(() => active && setLoading(false));
        }, 250);
        return () => {
            active = false;
            clearTimeout(id);
        };
    }, [query]);

    return { hits, loading };
}
