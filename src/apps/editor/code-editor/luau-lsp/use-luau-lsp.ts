import { useEffect } from "react";
import { resolveResource } from "@tauri-apps/api/path";
import { LuauLspClient } from "./client";
import { registerLuauLsp } from "./monaco-bridge";
import { setCurrentLspClient } from "./lsp-registry";
import { buildConfigRoot } from "./config";
import { discoverDefinitionFiles } from "./discover-definitions";
import { pathToUri } from "./uri";
import { listen } from "@tauri-apps/api/event";
import { readSettings, subscribeSettings, SettingsValues } from "../../../../lib/settings";
import { getProjectSnapshot, type ProjectSnapshot } from "../../../../lib/project";

const DEFINITIONS_RESOURCE = "resources/globalTypes.PluginSecurity.d.luau";
const TESTEZ_RESOURCE = "resources/testez.d.luau";

async function resolveBundled(resource: string): Promise<string | null> {
    try {
        return await resolveResource(resource);
    } catch (e) {
        console.warn("[luau-lsp] could not resolve", resource, e);
        return null;
    }
}

// This hook mounts as a child of ProjectProvider, so on a cold boot its effect
// runs before the provider opens the project and getProjectSnapshot returns null
// (empty store). Wait for project://opened so we see [test]/projectFile config.
async function snapshotWhenReady(): Promise<ProjectSnapshot | null> {
    const snap = await getProjectSnapshot();
    if (snap) return snap;
    return new Promise((resolve) => {
        let done = false;
        const finish = async () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            un.then((fn) => fn());
            resolve(await getProjectSnapshot());
        };
        const un = listen("project://opened", finish);
        const timer = setTimeout(finish, 3000);
    });
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
        let definitionsPaths: string[] = [];
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
            client = new LuauLspClient(pathToUri(rootPath), getConfig, definitionsPaths);
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
                resolveBundled(DEFINITIONS_RESOURCE),
                snapshotWhenReady(),
                discoverDefinitionFiles(rootPath),
            ]);
            if (stopped) return;
            // TestEZ injects describe/it/expect as globals; load their bundled
            // definitions only for projects that declare a [test] testez path, so
            // non-test projects don't get those globals workspace-wide.
            const testezDefs = snapshot?.testEz
                ? await resolveBundled(TESTEZ_RESOURCE)
                : null;
            if (stopped) return;
            currentValues = values;
            fflagsSig = fflagSignature(values);
            definitionsPaths = [defs, testezDefs].filter(
                (p): p is string => !!p,
            );
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
