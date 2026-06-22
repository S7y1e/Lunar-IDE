import { createContext } from "react";
import { FileNode } from "../../../lib/filesystem";

export type TreeSelection = {
    selected: string | null;
    select: (path: string) => void;
    openFile: (path: string) => void;
    // Active editor file, so the tree can auto-expand to it and highlight it.
    revealPath?: string | null;
    // Smart rename: updates requires (for modules) and follows open tabs.
    // Returns the new absolute path, or null when not handled.
    renameNode?: (node: FileNode, newName: string) => Promise<string | null>;
};

export const TreeSelectionContext = createContext<TreeSelection>({
    selected: null,
    select: () => {},
    openFile: () => {},
});
