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

// FFlags are process-global and locked at server boot, so a change to any of
// these requires a full restart — pushing config does nothing.
const FFLAG_KEYS = [
    "luau-lsp.fflags.enableByDefault",
    "luau-lsp.fflags.enableNewSolver",
    "luau-lsp.fflags.sync",
    "luau-lsp.fflags.override",
];

const fflagSignature = (values: SettingsValues): string =>
    JSON.stringify(FFLAG_KEYS.map((k) => values[k]));

export function useLuauLsp(rootPath: string) {
    useEffect(() => {
        let client: LuauLspClient | null = null;
        let dispose = () => {};
        let stopped = false;

        // Live config: getConfig reads this holder, so most settings changes
        // take effect without restarting the LSP.
        let currentValues: SettingsValues = {};
        let loaded = false;
        let fflagsSig = "";
        let definitions: string | null = null;
        let discovered: Record<string, string> = {};
        let projectFile: string | undefined;

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

        const spawn = async () => {
            dispose();
            await client?.stop().catch(() => {});
            if (stopped) return;
            client = new LuauLspClient(pathToUri(rootPath), getConfig, definitions);
            dispose = registerLuauLsp(client);
            setCurrentLspClient(client);
            try {
                await client.start();
            } catch (e) {
                console.error("[luau-lsp] failed to start", e);
            }
        };

        const unsubscribe = subscribeSettings((values) => {
            currentValues = values;
            if (!loaded) return; // initial spawn (below) will pick these up
            const sig = fflagSignature(values);
            if (sig !== fflagsSig) {
                fflagsSig = sig;
                spawn();
            } else {
                client?.notifyConfigChanged();
            }
        });

        (async () => {
            const [values, defs, snapshot, found] = await Promise.all([
                readSettings(),
                resolveDefinitions(),
                getProjectSnapshot(),
                discoverDefinitionFiles(rootPath),
            ]);
            if (stopped) return;
            currentValues = values;
            fflagsSig = fflagSignature(values);
            definitions = defs;
            discovered = found;
            projectFile = snapshot?.projectFile;
            loaded = true;
            await spawn();
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
