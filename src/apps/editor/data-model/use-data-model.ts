import { useEffect, useState } from "react";
import { watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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

        // EditorBody (this hook) is a child of ProjectProvider, so its mount
        // effect runs before the provider opens the project — the first fetch
        // hits an empty store and returns null. Listening for project://opened
        // races the emit, so instead retry briefly until the store is open.
        const refresh = (attempt = 0) => {
            getProjectDataModel()
                .then((next) => {
                    if (!active) return;
                    if (!next && attempt < 15) {
                        setTimeout(() => refresh(attempt + 1), 200);
                        return;
                    }
                    // Don't clobber a loaded tree with a transient null.
                    setTree((prev) => next ?? prev);
                    setLoading(false);
                    if (next) invoke("project_write_sourcemap").catch(() => {});
                })
                .catch(() => active && setLoading(false));
        };

        refresh();

        // Reload after a project change (e.g. project_setup_testez edits config).
        const changed = listen("project://changed", () => refresh());

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
            changed.then((fn) => fn());
        };
    }, [rootPath]);

    return { tree, loading };
}
