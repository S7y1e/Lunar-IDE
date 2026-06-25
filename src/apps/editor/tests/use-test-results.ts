import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
    runtimeEnqueue,
    setupTestez,
    useProject,
    type TestResults,
} from "../../../lib/project";

// Give up waiting on Studio after this long, so a missing/idle plugin surfaces
// an error instead of a spinner that never resolves.
const TIMEOUT_MS = 15000;

export function useTestResults() {
    const [results, setResults] = useState<TestResults | null>(null);
    const [running, setRunning] = useState(false);
    const [setupLog, setSetupLog] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reactive: updates when the project loads and on project://changed (which
    // project_setup_testez emits), so config survives a reload and flips right
    // after setup without a manual refetch race.
    const project = useProject();
    const configured =
        !!project?.testEz && (project.testRoots?.length ?? 0) > 0;

    const clearTimer = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
    };

    useEffect(() => {
        const un = listen<{ testResults?: TestResults }>(
            "runtime://message",
            (e) => {
                if (!e.payload.testResults) return;
                clearTimer();
                setResults(e.payload.testResults);
                setRunning(false);
            },
        );
        return () => {
            un.then((fn) => fn());
            clearTimer();
        };
    }, []);

    // One-click onboarding: install TestEZ, seed a spec, configure lunar.toml.
    // Returns the created spec's relative path (if any) so the caller can open it.
    const setup = async (): Promise<string | null> => {
        setBusy(true);
        setSetupLog(null);
        try {
            const res = await setupTestez();
            setSetupLog(res.log);
            return res.specFile;
        } catch (e) {
            setSetupLog(String(e));
            return null;
        } finally {
            setBusy(false);
        }
    };

    const run = async () => {
        if (!project?.testEz || (project.testRoots ?? []).length === 0) {
            setResults({
                error: "Set [test] testez + roots in lunar.toml to run TestEZ",
            });
            setRunning(false);
            return;
        }
        setResults(null);
        setRunning(true);
        clearTimer();
        timer.current = setTimeout(() => {
            setRunning(false);
            setResults({
                error: "No response from Studio — is the Lunar bridge plugin running?",
            });
        }, TIMEOUT_MS);
        await runtimeEnqueue({
            type: "runTests",
            testez: project.testEz,
            roots: project.testRoots,
        }).catch(() => {});
    };

    return { results, running, configured, setupLog, busy, run, setup };
}
