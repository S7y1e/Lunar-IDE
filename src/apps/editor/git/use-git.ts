import { useCallback, useEffect, useState } from "react";
import { watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import {
    gitCommit,
    gitDiscard,
    gitIsRepo,
    gitLog,
    gitStage,
    gitStageAll,
    gitStatus,
    gitUnstage,
    type GitCommit,
    type GitStatus,
} from "../../../lib/git";

export function useGit(rootPath: string) {
    const [isRepo, setIsRepo] = useState<boolean | null>(null);
    const [status, setStatus] = useState<GitStatus | null>(null);
    const [commits, setCommits] = useState<GitCommit[]>([]);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            const repo = await gitIsRepo();
            setIsRepo(repo);
            if (!repo) return;
            const [s, log] = await Promise.all([gitStatus(), gitLog()]);
            setStatus(s);
            setCommits(log);
            setError(null);
        } catch (e) {
            setError(String(e));
        }
    }, []);

    useEffect(() => {
        let active = true;
        let unwatch: UnwatchFn | null = null;
        refresh();
        (async () => {
            try {
                const fn = await watch(rootPath, () => active && refresh(), {
                    recursive: true,
                    delayMs: 600,
                });
                if (active) unwatch = fn;
                else fn();
            } catch (e) {
                console.warn("[git] watch failed", e);
            }
        })();
        return () => {
            active = false;
            unwatch?.();
        };
    }, [rootPath, refresh]);

    const act = (fn: () => Promise<unknown>) => fn().then(refresh).catch((e) => setError(String(e)));

    return {
        isRepo,
        status,
        commits,
        error,
        refresh,
        stage: (p: string) => act(() => gitStage(p)),
        unstage: (p: string) => act(() => gitUnstage(p)),
        stageAll: () => act(() => gitStageAll()),
        discard: (p: string) => act(() => gitDiscard(p)),
        commit: (msg: string) => act(() => gitCommit(msg)),
    };
}
