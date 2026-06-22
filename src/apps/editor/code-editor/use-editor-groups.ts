import { useRef, useState } from "react";
import { canonicalPath } from "./luau-lsp/uri";

export type EditorGroup = { id: number; files: string[]; active: string | null };

const MAX_GROUPS = 3;

export function useEditorGroups() {
    const [groups, setGroups] = useState<EditorGroup[]>([
        { id: 0, files: [], active: null },
    ]);
    const [activeGroupId, setActiveGroupId] = useState(0);
    const nextId = useRef(1);

    const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0];

    const patch = (id: number, fn: (g: EditorGroup) => EditorGroup) =>
        setGroups((gs) => gs.map((g) => (g.id === id ? fn(g) : g)));

    const openFile = (rawPath: string) => {
        const path = canonicalPath(rawPath);
        patch(activeGroupId, (g) => ({
            ...g,
            files: g.files.includes(path) ? g.files : [...g.files, path],
            active: path,
        }));
    };

    const selectInGroup = (id: number, path: string) => {
        setActiveGroupId(id);
        patch(id, (g) => ({ ...g, active: path }));
    };

    // Close a tab; an emptied split group is dropped, but the last group always
    // survives (as an empty placeholder) so the editor never has zero groups.
    const closeInGroup = (id: number, path: string) =>
        setGroups((gs) => {
            const mapped = gs.map((g) => {
                if (g.id !== id) return g;
                const index = g.files.indexOf(path);
                const remaining = g.files.filter((p) => p !== path);
                const active =
                    g.active === path
                        ? remaining[index] ?? remaining[index - 1] ?? null
                        : g.active;
                return { ...g, files: remaining, active };
            });
            const nonEmpty = mapped.filter((g) => g.files.length > 0);
            const final = nonEmpty.length
                ? nonEmpty
                : [{ id: mapped[0].id, files: [], active: null }];
            if (!final.some((g) => g.id === activeGroupId))
                setActiveGroupId(final[final.length - 1].id);
            return final;
        });

    const reorderInGroup = (id: number, from: number, to: number) =>
        patch(id, (g) => {
            const files = [...g.files];
            const [moved] = files.splice(from, 1);
            files.splice(to, 0, moved);
            return { ...g, files };
        });

    // Follow a disk rename across every group, keeping order and active tabs.
    const renameFile = (oldPath: string, newPath: string) => {
        const remap = (p: string) =>
            p === oldPath
                ? newPath
                : p.startsWith(oldPath + "\\") || p.startsWith(oldPath + "/")
                  ? newPath + p.slice(oldPath.length)
                  : p;
        setGroups((gs) =>
            gs.map((g) => ({
                ...g,
                files: g.files.map(remap),
                active: g.active ? remap(g.active) : g.active,
            })),
        );
    };

    const splitEditor = () => {
        const file = activeGroup.active;
        if (!file || groups.length >= MAX_GROUPS) return;
        const id = nextId.current++;
        setGroups((gs) => [...gs, { id, files: [file], active: file }]);
        setActiveGroupId(id);
    };

    return {
        groups,
        activeGroupId,
        activeFile: activeGroup.active,
        canSplit: groups.length < MAX_GROUPS,
        openFile,
        focusGroup: setActiveGroupId,
        selectInGroup,
        closeInGroup,
        reorderInGroup,
        renameFile,
        splitEditor,
    };
}
