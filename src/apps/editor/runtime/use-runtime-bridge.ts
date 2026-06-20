import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type RuntimeLevel = "output" | "info" | "warning" | "error";
export type RuntimeMessage = { text: string; type: RuntimeLevel; time: number };
type RuntimeStatus = { running: boolean; port: number };

const MAX_MESSAGES = 1000;
// How long to keep showing "in play-test" after the last running:true ping.
const PLAYTEST_TTL = 2000;

export function useRuntimeBridge() {
    const [messages, setMessages] = useState<RuntimeMessage[]>([]);
    const [status, setStatus] = useState<RuntimeStatus>({
        running: false,
        port: 34900,
    });
    // Whether Studio is currently in a play-test. The plugin reads this from the
    // edit context, where it's unstable during a Play Solo (flaps true/false), so
    // we treat `running:true` as a heartbeat: stay in play-test while pings keep
    // arriving, and only fall back to idle once they stop for PLAYTEST_TTL.
    const [playtest, setPlaytest] = useState(false);
    const playtestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Studio can emit a burst of lines on play-test start; buffer and flush on a
    // timer so a burst costs one render instead of hundreds (mirrors the sync log).
    const bufferRef = useRef<RuntimeMessage[]>([]);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const push = (batch: RuntimeMessage[]) => {
        bufferRef.current.push(...batch);
        if (timerRef.current !== null) return;
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            const buffered = bufferRef.current;
            bufferRef.current = [];
            setMessages((prev) => [...prev, ...buffered].slice(-MAX_MESSAGES));
        }, 120);
    };

    useEffect(() => {
        // The bridge is started once by the Rust backend at launch; here we only
        // read its status and stream messages — never start/stop it from React.
        invoke<RuntimeStatus>("runtime_bridge_status").then(setStatus).catch(() => {});

        const unlistenMsg = listen<{ messages?: RuntimeMessage[]; running?: boolean }>(
            "runtime://message",
            (event) => {
                // Only `true` pings matter; absence of them (not an explicit
                // `false`) is what means the play-test stopped.
                if (event.payload.running === true) {
                    setPlaytest(true);
                    if (playtestTimer.current) clearTimeout(playtestTimer.current);
                    playtestTimer.current = setTimeout(
                        () => setPlaytest(false),
                        PLAYTEST_TTL,
                    );
                }
                push(event.payload.messages ?? []);
            }
        );

        return () => {
            unlistenMsg.then((fn) => fn());
            if (timerRef.current !== null) clearTimeout(timerRef.current);
            if (playtestTimer.current !== null) clearTimeout(playtestTimer.current);
        };
    }, []);

    const clear = () => setMessages([]);

    return {
        messages,
        running: status.running,
        port: status.port,
        playtest,
        clear,
    };
}
