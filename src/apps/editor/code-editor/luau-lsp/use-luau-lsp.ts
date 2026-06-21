import { useEffect } from "react";
import { resolveResource } from "@tauri-apps/api/path";
import { LuauLspClient } from "./client";
import { registerLuauLsp } from "./monaco-bridge";
import { setCurrentLspClient } from "./lsp-registry";
import { buildConfigRoot } from "./config";
import { discoverDefinitionFiles } from "./discover-definitions";
import { pathToUri } from "./uri";
import { readSettings, subscribeSettings, SettingsValues } from "../../../../lib/settings";
import { getProjectSnapshot } from "../../../../lib/project";

const DEFINITIONS_RESOURCE = "resources/globalTypes.PluginSecurity.d.luau";

async function resolveDefinitions(): Promise<string | null> {
    try {
        return await resolveResource(DEFINITIONS_RESOURCE);
    } catch (e) {
        console.warn("[luau-lsp] could not resolve Roblox definitions", e);
        return null;
    }
}

export function useLuauLsp(rootPath: string) {
    useEffect(() => {
        let client: LuauLspClient | null = null;
        let dispose = () => {};
        let stopped = false;

        // Live config: getConfig reads this holder, so settings changes take
        // effect without restarting the LSP.
        let currentValues: SettingsValues = {};

        const unsubscribe = subscribeSettings((values) => {
            currentValues = values;
            client?.notifyConfigChanged();
        });

        (async () => {
            const [values, definitions, snapshot, discovered] = await Promise.all([
                readSettings(),
                resolveDefinitions(),
                getProjectSnapshot(),
                discoverDefinitionFiles(rootPath),
            ]);
            if (stopped) return;
            currentValues = values;
            const projectFile = snapshot?.projectFile;
            const getConfig = () => {
                const userDefs =
                    (currentValues["luau-lsp.types.definitionFiles"] as
                        | Record<string, string>
                        | undefined) ?? {};
                return buildConfigRoot({
                    ...currentValues,
                    // Discovered defs are a baseline; explicit user entries win.
                    "luau-lsp.types.definitionFiles": { ...discovered, ...userDefs },
                    ...(projectFile
                        ? { "luau-lsp.sourcemap.rojoProjectFile": projectFile }
                        : {}),
                });
            };
            client = new LuauLspClient(
                pathToUri(rootPath),
                getConfig,
                definitions
            );
            dispose = registerLuauLsp(client);
            setCurrentLspClient(client);
            try {
                await client.start();
            } catch (e) {
                console.error("[luau-lsp] failed to start", e);
            }
        })();

        return () => {
            stopped = true;
            unsubscribe();
            dispose();
            setCurrentLspClient(null);
            client?.stop().catch(() => {});
        };
    }, [rootPath]);
}
