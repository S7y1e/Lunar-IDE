import { Command } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { getProjectSnapshot } from "../../../lib/project";
import { SyncBackend } from "../sync/use-sync-server";
import { Toasts } from "../notifications/use-toasts";

const SIDECAR: Record<SyncBackend, string> = {
    rojo: "binaries/rojo",
    argon: "binaries/argon",
};

function buildArgs(backend: SyncBackend, projectFile: string, output: string): string[] {
    if (backend === "argon") {
        return ["build", projectFile, "--output", output, "--yes", "--color", "never"];
    }
    return ["build", projectFile, "--output", output, "--color", "never"];
}

export function useBuild(rootPath: string, backend: SyncBackend, toasts: Toasts) {
    const build = async () => {
        const snapshot = await getProjectSnapshot();
        const projectFile = snapshot?.projectFile ?? "default.project.json";
        const output = `${snapshot?.name ?? "place"}.rbxl`;

        const id = toasts.push("info", `Building ${output}…`);
        let stderr = "";

        const command = Command.sidecar(SIDECAR[backend], buildArgs(backend, projectFile, output), {
            cwd: rootPath,
        });
        command.stderr.on("data", (line) => {
            stderr += line;
        });
        command.on("close", (data) => {
            if (data.code === 0) {
                toasts.set(id, "success", `Built ${output}`, undefined, 5000);
            } else {
                toasts.set(id, "error", "Build failed", stderr.trim());
            }
        });
        command.on("error", (error) => {
            toasts.set(id, "error", "Build failed", String(error));
        });

        try {
            const child = await command.spawn();
            if (typeof child.pid === "number") {
                invoke("assign_to_job", { pid: child.pid }).catch(() => {});
            }
        } catch (error) {
            toasts.set(id, "error", "Build failed", String(error));
        }
    };

    return { build };
}
