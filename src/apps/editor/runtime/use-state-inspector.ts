import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { diff, type ChangeKind, type JsonValue } from "./state-diff";

export type Watch = {
    name: string;
    snapshot: JsonValue;
    changes: Map<string, ChangeKind>;
    changeSeq: number;
    t?: number;
};

type WatchMsg = { name: string; snapshot?: JsonValue; gone?: boolean; t?: number };
type StatePayload = { state?: { watches?: WatchMsg[] }; running?: boolean };

export function useStateInspector() {
    const [watches, setWatches] = useState<Map<string, Watch>>(new Map());
    const seqRef = useRef(0);

    const apply = (incoming: WatchMsg[]) => {
        setWatches((prev) => {
            const next = new Map(prev);
            for (const w of incoming) {
                if (w.gone) {
                    next.delete(w.name);
                    continue;
                }
                const old = next.get(w.name);
                const snap = w.snapshot ?? null;
                const changes = old
                    ? diff(old.snapshot, snap, w.name)
                    : new Map<string, ChangeKind>();
                next.set(w.name, {
                    name: w.name,
                    snapshot: snap,
                    changes,
                    changeSeq: ++seqRef.current,
                    t: w.t,
                });
            }
            return next;
        });
    };

    useEffect(() => {
        const unlisten = listen<StatePayload>("runtime://message", (event) => {
            // Don't auto-clear on running:false — the plugin's run flag flaps
            // during a Play Solo, which would wipe watches mid-test. Watches just
            // update by name; the Clear button handles stale ones.
            const w = event.payload.state?.watches;
            if (w && w.length) apply(w);
        });
        return () => {
            unlisten.then((fn) => fn());
        };
    }, []);

    const clear = () => setWatches(new Map());

    return { watches: [...watches.values()], clear };
}
