import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { runtimeEnqueue } from "../../../lib/project";

export type WatchExpr = { id: string; expr: string };
export type WatchResult = { value: string; ok: boolean };

type WatchPayload = {
    evalWatches?: { id: string; value: string; ok: boolean }[];
};

// Re-send the watch list this often so a reloaded/reconnected plugin recovers it
// (commands are one-shot drains, lost if the plugin wasn't polling when sent).
const RESEND_MS = 3000;

export function useEvalWatches() {
    const [watches, setWatches] = useState<WatchExpr[]>([]);
    const [results, setResults] = useState<Map<string, WatchResult>>(new Map());
    const watchesRef = useRef(watches);
    watchesRef.current = watches;
    const idRef = useRef(0);

    const send = (list: WatchExpr[]) =>
        runtimeEnqueue({ type: "setWatches", watches: list }).catch(() => {});

    const add = (expr: string) => {
        const trimmed = expr.trim();
        if (!trimmed) return;
        const next = [...watches, { id: `w${++idRef.current}`, expr: trimmed }];
        setWatches(next);
        send(next);
    };

    const remove = (id: string) => {
        const next = watches.filter((w) => w.id !== id);
        setWatches(next);
        send(next);
        setResults((prev) => {
            const m = new Map(prev);
            m.delete(id);
            return m;
        });
    };

    const update = (id: string, expr: string) => {
        const next = watches.map((w) => (w.id === id ? { ...w, expr } : w));
        setWatches(next);
        send(next);
    };

    useEffect(() => {
        const unlisten = listen<WatchPayload>("runtime://message", (event) => {
            const incoming = event.payload.evalWatches;
            if (!incoming?.length) return;
            setResults((prev) => {
                const m = new Map(prev);
                for (const r of incoming) m.set(r.id, { value: r.value, ok: r.ok });
                return m;
            });
        });

        const timer = setInterval(() => {
            if (watchesRef.current.length) send(watchesRef.current);
        }, RESEND_MS);

        return () => {
            unlisten.then((fn) => fn());
            clearInterval(timer);
        };
    }, []);

    return { watches, results, add, remove, update };
}
