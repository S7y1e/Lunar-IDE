import { useEffect, useRef } from "react";
import { Command, Child } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { exists } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { readSettings } from "../../../../lib/settings";
import { getProjectSnapshot } from "../../../../lib/project";

function setting<T>(values: Record<string, unknown>, key: string, fallback: T): T {
    return key in values ? (values[key] as T) : fallback;
}

function generator(backend: string, projectFile: string, sourcemapFile: string, includeNonScripts: boolean) {
    if (backend === "argon") {
        const args = ["sourcemap", projectFile, "--output", sourcemapFile, "--watch", "--yes", "--color", "never"];
        if (includeNonScripts) args.push("--non-scripts");
        return { sidecar: "binaries/argon", args };
    }
    const args = ["sourcemap", projectFile, "--output", sourcemapFile, "--watch"];
    if (includeNonScripts) args.push("--include-non-scripts");
    return { sidecar: "binaries/rojo", args };
}

export function useSourcemap(
    rootPath: string,
    onError?: (detail: string) => void
) {
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    useEffect(() => {
        let child: Child | null = null;
        let stopped = false;
        // The sourcemap is the spine of DataModel + runtime remap. When rojo/argon
        // fails to generate it, everything downstream silently breaks — so surface
        // the error. Dedupe since --watch reprints it on every file change.
        let reported = "";

        (async () => {
            const [values, snapshot] = await Promise.all([
                readSettings(),
                getProjectSnapshot(),
            ]);
            if (stopped) return;
            if (!setting(values, "luau-lsp.sourcemap.enabled", true)) return;

            const projectFile = snapshot?.projectFile ?? "default.project.json";
            const sourcemapFile = setting(
                values,
                "luau-lsp.sourcemap.sourcemapFile",
                "sourcemap.json",
            );
            const includeNonScripts = setting(
                values,
                "luau-lsp.sourcemap.includeNonScripts",
                true,
            );

            if (!(await exists(await join(rootPath, projectFile)))) return;
            if (stopped) return;

            const backend = snapshot?.syncBackend === "argon" ? "argon" : "rojo";
            const { sidecar, args } = generator(
                backend,
                projectFile,
                sourcemapFile,
                includeNonScripts,
            );

            const command = Command.sidecar(sidecar, args, { cwd: rootPath });
            command.stderr.on("data", (line) => {
                console.warn("[sourcemap]", line);
                const text = String(line);
                if (!/\[ERROR|ERROR:/.test(text)) return;
                const detail = text
                    .replace(/^\s*\[ERROR[^\]]*\]\s*/, "")
                    .replace(/^\s*ERROR:\s*/, "")
                    .trim();
                if (detail && detail !== reported) {
                    reported = detail;
                    onErrorRef.current?.(detail);
                }
            });
            command.on("error", (error) =>
                console.error("[sourcemap]", error),
            );

            try {
                const spawned = await command.spawn();
                if (stopped) {
                    spawned.kill().catch(() => {});
                    return;
                }
                child = spawned;
                if (typeof child.pid === "number") {
                    invoke("assign_to_job", { pid: child.pid }).catch(() => {});
                }
            } catch (error) {
                console.error("[sourcemap] failed to start", error);
            }
        })();

        return () => {
            stopped = true;
            child?.kill().catch(() => {});
            child = null;
        };
    }, [rootPath]);
}
