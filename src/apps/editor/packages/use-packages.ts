import { useCallback, useEffect, useState } from "react";
import { watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import {
    projectPackages,
    wallyInstall,
    wallyUpdate,
    type PackageList,
    type ShellRun,
} from "../../../lib/packages";

const RELEVANT = /(wally\.toml|wally\.lock)$/;

export function usePackages(rootPath: string) {
    const [list, setList] = useState<PackageList | null>(null);
    const [busy, setBusy] = useState(false);
    const [log, setLog] = useState<string | null>(null);

    const refresh = useCallback(() => {
        projectPackages().then(setList).catch(() => {});
    }, []);

    useEffect(() => {
        let active = true;
        let unwatch: UnwatchFn | null = null;
        refresh();
        (async () => {
            try {
                const fn = await watch(
                    rootPath,
                    (e) => {
                        if (e.paths.some((p) => RELEVANT.test(p))) refresh();
                    },
                    { recursive: false, delayMs: 400 },
                );
                if (active) unwatch = fn;
                else fn();
            } catch {
                /* watch best-effort */
            }
        })();
        return () => {
            active = false;
            unwatch?.();
        };
    }, [rootPath, refresh]);

    const run = useCallback(
        async (fn: () => Promise<ShellRun>) => {
            setBusy(true);
            setLog(null);
            try {
                const r = await fn();
                setLog(r.output.trim() || (r.code === 0 ? "Done." : `Exited ${r.code}`));
                refresh();
            } catch (e) {
                setLog(String(e));
            } finally {
                setBusy(false);
            }
        },
        [refresh],
    );

    return {
        list,
        busy,
        log,
        refresh,
        install: () => run(wallyInstall),
        update: () => run(wallyUpdate),
    };
}
