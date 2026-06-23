import { useEffect, useState } from "react";
import { watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { getProjectInsights, type Insights } from "../../../lib/project";

const RELEVANT = /(\.luau|\.lua|sourcemap\.json)$/;

export function useInsights(rootPath: string) {
    const [insights, setInsights] = useState<Insights | null>(null);
    const [loading, setLoading] = useState(true);
    const [nonce, setNonce] = useState(0);

    useEffect(() => {
        let active = true;
        let unwatch: UnwatchFn | null = null;

        const refresh = () => {
            getProjectInsights()
                .then((next) => {
                    if (!active) return;
                    setInsights(next);
                    setLoading(false);
                })
                .catch(() => active && setLoading(false));
        };

        refresh();

        (async () => {
            try {
                const fn = await watch(
                    rootPath,
                    (event) => {
                        if (event.paths.some((p) => RELEVANT.test(p))) refresh();
                    },
                    { recursive: true, delayMs: 500 },
                );
                if (active) unwatch = fn;
                else fn();
            } catch (e) {
                console.warn("[insights] watch failed", e);
            }
        })();

        return () => {
            active = false;
            unwatch?.();
        };
    }, [rootPath, nonce]);

    return { insights, loading, refresh: () => setNonce((n) => n + 1) };
}
