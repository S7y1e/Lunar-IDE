import { useEffect, useRef, useState } from "react";
import { Command, Child } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { readSettings } from "../../../lib/settings";
import { useProject } from "../../../lib/project";

export type SyncBackend = "rojo" | "argon";
export type SyncStatus = "stopped" | "running" | "error";
export type ConnectionPhase = "starting" | "serving" | "error";

const MAX_LOG_LINES = 500;

const DEFAULT_PORT: Record<SyncBackend, number> = {
    rojo: 34872,
    argon: 8000,
};

const SIDECAR: Record<SyncBackend, string> = {
    rojo: "binaries/rojo",
    argon: "binaries/argon",
};

function isServingLine(line: string): boolean {
    const l = line.toLowerCase();
    return l.includes("serving on") || l.includes("server listening");
}

function serveArgs(backend: SyncBackend, port: number): string[] {
    if (backend === "argon") {
        return ["serve", "--port", String(port), "--yes", "--color", "never"];
    }
    return ["serve", "--port", String(port)];
}

function runArgonConfig(key: string, value: string, cwd: string): Promise<void> {
    const command = Command.sidecar(
        "binaries/argon",
        ["config", key, value, "--config", "workspace", "--yes"],
        { cwd }
    );
    return new Promise((resolve) => {
        command.on("close", () => resolve());
        command.on("error", () => resolve());
        command.spawn().catch(() => resolve());
    });
}

async function applyArgonConfig(
    cwd: string,
    log: (line: string) => void
): Promise<void> {
    const values = await readSettings();
    const keys = Object.keys(values).filter((key) => key.startsWith("argon."));
    if (keys.length === 0) return;
    log(`Applying ${keys.length} Argon setting(s)...`);
    for (const fullKey of keys) {
        await runArgonConfig(fullKey.slice("argon.".length), String(values[fullKey]), cwd);
    }
}

export function useSyncServer(rootPath: string) {
    const project = useProject();
    const [backend, setBackendState] = useState<SyncBackend>("rojo");
    const [status, setStatus] = useState<SyncStatus>("stopped");
    const [phase, setPhase] = useState<ConnectionPhase>("starting");
    const [logs, setLogs] = useState<string[]>([]);
    const [port, setPort] = useState(DEFAULT_PORT.rojo);
    const childRef = useRef<Child | null>(null);

    // Rojo/Argon can emit hundreds of lines in a burst on startup. Updating
    // state per line copies the whole log array and re-renders the panel each
    // time, which freezes the UI. Buffer incoming lines and flush them on a
    // timer so a burst costs one render instead of hundreds.
    const logBufferRef = useRef<string[]>([]);
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const append = (line: string) => {
        if (isServingLine(line)) setPhase("serving");
        logBufferRef.current.push(line);
        if (flushTimerRef.current !== null) return;
        flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = null;
            const buffered = logBufferRef.current;
            logBufferRef.current = [];
            setLogs((prev) => [...prev, ...buffered].slice(-MAX_LOG_LINES));
        }, 120);
    };

    const setBackend = (next: SyncBackend) => {
        if (childRef.current) return;
        setBackendState(next);
        setPort(DEFAULT_PORT[next]);
    };

    const manifestBackend = project?.syncBackend;
    useEffect(() => {
        if (manifestBackend !== "rojo" && manifestBackend !== "argon") return;
        if (childRef.current) return;
        setBackendState(manifestBackend);
        setPort(DEFAULT_PORT[manifestBackend]);
    }, [manifestBackend]);

    const start = async () => {
        if (childRef.current) return;
        logBufferRef.current = [];
        setLogs([]);
        setStatus("running");
        setPhase("starting");
        try {
            if (backend === "argon") {
                await applyArgonConfig(rootPath, append);
                append("Lunar owns the sourcemap; disabling argon serve with_sourcemap.");
                await runArgonConfig("with_sourcemap", "false", rootPath);
            }
            const command = Command.sidecar(
                SIDECAR[backend],
                serveArgs(backend, port),
                { cwd: rootPath }
            );
            command.stdout.on("data", (line) => append(line));
            command.stderr.on("data", (line) => append(line));
            command.on("error", (error) => {
                append(String(error));
                setStatus("error");
                setPhase("error");
            });
            command.on("close", () => {
                childRef.current = null;
                setStatus("stopped");
                setPhase("starting");
            });
            childRef.current = await command.spawn();
            // Tie the sidecar to the app's lifetime so an abrupt exit (Ctrl+C,
            // crash) can't leave it orphaned holding the port. Best-effort.
            if (typeof childRef.current.pid === "number") {
                invoke("assign_to_job", { pid: childRef.current.pid }).catch(
                    () => {}
                );
            }
        } catch (error) {
            append(String(error));
            setStatus("error");
            setPhase("error");
        }
    };

    const stop = async () => {
        await childRef.current?.kill();
        childRef.current = null;
        setStatus("stopped");
        setPhase("starting");
    };

    // Switching projects keeps this hook mounted and only changes `rootPath`,
    // so a server started for the old project would otherwise keep holding its
    // port. Tear it down whenever the project changes (and on unmount).
    //
    // Closing the window is handled by the editor's single close handler (it
    // calls `stop` before destroying the window), so we don't register our own
    // close listener here — two competing handlers both calling preventDefault
    // would deadlock the close.
    useEffect(() => {
        return () => {
            childRef.current?.kill();
            childRef.current = null;
            if (flushTimerRef.current !== null) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }
            setStatus("stopped");
        };
    }, [rootPath]);

    return { backend, setBackend, status, phase, logs, port, setPort, start, stop };
}
