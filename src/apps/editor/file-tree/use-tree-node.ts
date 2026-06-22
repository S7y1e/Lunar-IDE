import { useEffect, useState } from "react";
import { confirm, message } from "@tauri-apps/plugin-dialog";
import type { UnwatchFn } from "@tauri-apps/plugin-fs";
import {
    FileNode,
    readDirectory,
    createFile,
    createFolder,
    deleteEntry,
    renameEntry,
    watchDirectory,
} from "../../../lib/filesystem";
import { MenuItem } from "./context-menu";

type Params = {
    node: FileNode;
    defaultExpanded: boolean;
    onChanged?: () => void;
    renameNode?: (node: FileNode, newName: string) => Promise<string | null>;
};

export function useTreeNode({ node, defaultExpanded, onChanged, renameNode }: Params) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [children, setChildren] = useState<FileNode[]>([]);
    const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
    const [renaming, setRenaming] = useState(false);
    const [creating, setCreating] = useState<"file" | "folder" | null>(null);

    useEffect(() => {
        if (defaultExpanded && node.isDir) {
            readDirectory(node.path).then(setChildren);
        }
    }, []);

    const reload = async () => setChildren(await readDirectory(node.path));

    // Keep the explorer in sync with the disk: while a folder is expanded, watch
    // it so external renames/creates/deletes (Argon, git, another editor) show
    // up automatically. We only re-read this directory's listing, so expansion
    // state of other nodes is preserved (unlike a full tree remount).
    useEffect(() => {
        if (!expanded || !node.isDir) return;
        let unwatch: UnwatchFn | undefined;
        let active = true;
        watchDirectory(node.path, () => {
            readDirectory(node.path).then(setChildren).catch(() => {});
        })
            .then((fn) => {
                if (active) unwatch = fn;
                else fn();
            })
            .catch(() => {});
        return () => {
            active = false;
            unwatch?.();
        };
    }, [expanded, node.path]);

    const ensureLoaded = async () => {
        if (children.length === 0) setChildren(await readDirectory(node.path));
    };

    const toggle = async () => {
        if (!node.isDir) return;
        if (!expanded) await ensureLoaded();
        setExpanded(!expanded);
    };

    const expand = async () => {
        if (!node.isDir || expanded) return;
        await ensureLoaded();
        setExpanded(true);
    };

    const startCreate = async (kind: "file" | "folder") => {
        await ensureLoaded();
        setExpanded(true);
        setCreating(kind);
    };

    const submitCreate = async (name: string) => {
        const kind = creating;
        const trimmed = name.trim();
        setCreating(null);
        if (!trimmed || !kind) return;
        try {
            if (kind === "folder") await createFolder(node.path, trimmed);
            else await createFile(node.path, trimmed);
            await reload();
        } catch (err) {
            await message(String(err), { title: "Error", kind: "error" });
        }
    };

    const submitRename = async (name: string) => {
        const trimmed = name.trim();
        setRenaming(false);
        if (!trimmed || trimmed === node.name) return;
        try {
            // renameNode (when wired) rewrites requires and follows open tabs;
            // fall back to a plain disk rename when used standalone.
            if (renameNode) await renameNode(node, trimmed);
            else await renameEntry(node.path, trimmed);
            onChanged?.();
        } catch (err) {
            await message(String(err), { title: "Error", kind: "error" });
        }
    };

    const remove = async () => {
        const ok = await confirm(`Delete "${node.name}"?`, {
            title: "Delete",
            kind: "warning",
        });
        if (!ok) return;
        try {
            await deleteEntry(node.path, node.isDir);
            onChanged?.();
        } catch (err) {
            await message(String(err), { title: "Error", kind: "error" });
        }
    };

    const menuItems: MenuItem[] = [
        ...(node.isDir
            ? [
                  { label: "New File", onClick: () => startCreate("file") },
                  { label: "New Folder", onClick: () => startCreate("folder") },
              ]
            : []),
        ...(onChanged
            ? [
                  { label: "Rename", onClick: () => setRenaming(true) },
                  { label: "Delete", danger: true, onClick: remove },
              ]
            : []),
    ];

    return {
        expanded,
        children,
        menu,
        renaming,
        creating,
        setMenu,
        setRenaming,
        setCreating,
        toggle,
        expand,
        reload,
        submitCreate,
        submitRename,
        menuItems,
    };
}
