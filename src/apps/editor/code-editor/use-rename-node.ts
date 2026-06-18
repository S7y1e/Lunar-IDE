import { useCallback } from "react";
import { message } from "@tauri-apps/plugin-dialog";
import { renameEntry, type FileNode } from "../../../lib/filesystem";
import { buildRenamePlanForFile, applyRenamePlan } from "../refactor/rename-module";

// Rename from the file tree: module files rewrite requires in dependents (same
// engine as the Rename dialog); other files/folders just move on disk. Either
// way open tabs follow the new path. Returns the new absolute path.
export function useRenameNode(path: string, renameFile: (oldPath: string, newPath: string) => void) {
    return useCallback(
        async (node: FileNode, newName: string): Promise<string | null> => {
            try {
                let newAbs: string;
                if (!node.isDir && /\.luau?$/i.test(node.path)) {
                    const plan = await buildRenamePlanForFile(path, node.path, newName);
                    newAbs = plan
                        ? await applyRenamePlan(path, plan)
                        : await renameEntry(node.path, newName);
                } else {
                    newAbs = await renameEntry(node.path, newName);
                }
                renameFile(node.path, newAbs);
                return newAbs;
            } catch (err) {
                await message(String(err), { title: "Error", kind: "error" });
                return null;
            }
        },
        [path, renameFile],
    );
}
