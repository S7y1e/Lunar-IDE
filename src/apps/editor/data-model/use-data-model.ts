import { useEffect, useState } from "react";
import { watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { getProjectDataModel, type DataModelNode } from "../../../lib/project";

const WATCHED_EXTS = [".luau", ".lua", ".json", ".toml"];

function isRelevant(path: string): boolean {
    // Never react to our own sourcemap write, or we'd loop forever:
    // write sourcemap.json → watcher fires → regenerate → write → …
    if (path.replace(/\\/g, "/").endsWith("sourcemap.json")) return false;
    return WATCHED_EXTS.some((ext) => path.endsWith(ext));
}

export function useDataModel(rootPath: string) {
    const [tree, setTree] = useState<DataModelNode | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        let unwatch: UnwatchFn | null = null;

        const refresh = () => {
            getProjectDataModel()
                .then((next) => {
                    if (!active) return;
                    setTree(next);
                    setLoading(false);
                    invoke("project_write_sourcemap").catch(() => {});
                })
                .catch(() => active && setLoading(false));
        };

        refresh();

        (async () => {
            try {
                const fn = await watch(
                    rootPath,
                    (event) => {
                        if (event.paths.some(isRelevant)) refresh();
                    },
                    { recursive: true, delayMs: 300 },
                );
                if (active) unwatch = fn;
                else fn();
            } catch (e) {
                console.warn("[datamodel] watch failed", e);
            }
        })();

        return () => {
            active = false;
            unwatch?.();
        };
    }, [rootPath]);

    return { tree, loading };
}
