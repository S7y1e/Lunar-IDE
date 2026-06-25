import { useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { type Command } from "./commands";
import { type ToolId } from "../layout/layout-types";
import { type SyncBackend, type SyncStatus } from "../sync/use-sync-server";
import { useToasts } from "../notifications/use-toasts";

type Deps = {
    backend: SyncBackend;
    port: number;
    status: SyncStatus;
    startSync: () => void | Promise<void>;
    stopSync: () => void | Promise<void>;
    build: () => void;
    test: () => void;
    testCommand?: string | null;
    runTests: () => void | Promise<void>;
    clearRuntime: () => void;
    openPalette: () => void;
    toggle: (id: ToolId) => void;
    showView: (id: ToolId) => void;
    activeFile: string | null;
    toasts: ReturnType<typeof useToasts>;
    setRenaming: (open: boolean) => void;
    setSettingsOpen: (open: boolean) => void;
    showCallHierarchy: () => void;
    showFindUsages: () => void;
};

// Command surface: actions on the project, surfaced in the palette (type ">").
export function useEditorCommands(d: Deps): Command[] {
    return useMemo<Command[]>(
        () => [
            {
                id: "sync.start",
                title: "Sync: Start server",
                hint: `${d.backend} · :${d.port}`,
                enabled: d.status !== "running",
                run: d.startSync,
            },
            {
                id: "sync.stop",
                title: "Sync: Stop server",
                enabled: d.status === "running",
                run: d.stopSync,
            },
            { id: "build", title: "Build: Place file", hint: `${d.backend} build`, run: d.build },
            {
                id: "test",
                title: "Test: Run tests",
                hint: d.testCommand ?? "set [test] command in lunar.toml",
                run: d.test,
            },
            {
                id: "test.testez",
                title: "Test: Run (TestEZ)",
                hint: "run TestEZ in Studio (edit mode)",
                run: () => {
                    d.showView("tests");
                    d.runTests();
                },
            },
            { id: "runtime.clear", title: "Runtime: Clear output", run: d.clearRuntime },
            {
                id: "sourcemap.regenerate",
                title: "Sourcemap: Regenerate",
                hint: "rebuild sourcemap.json for the LSP",
                run: async () => {
                    try {
                        await invoke("project_write_sourcemap");
                        d.toasts.push("success", "Sourcemap regenerated");
                    } catch (e) {
                        d.toasts.push("error", `Sourcemap failed: ${e}`);
                    }
                },
            },
            { id: "search.everywhere", title: "Search Everywhere", hint: "double-shift", run: d.openPalette },
            { id: "search.find", title: "Search: Find in Files", run: () => d.showView("search") },
            { id: "view.todo", title: "Go to: TODO", run: () => d.showView("todo") },
            {
                id: "refactor.renameModule",
                title: "Refactor: Rename module…",
                hint: d.activeFile ? undefined : "open a module first",
                run: () =>
                    d.activeFile
                        ? d.setRenaming(true)
                        : d.toasts.push("error", "Open a module file to rename it"),
            },
            { id: "terminal.toggle", title: "Terminal: Toggle", run: () => d.toggle("terminal") },
            { id: "view.project", title: "Go to: Project", run: () => d.showView("project") },
            { id: "view.datamodel", title: "Go to: DataModel", run: () => d.showView("datamodel") },
            { id: "view.structure", title: "Go to: Structure", run: () => d.showView("structure") },
            { id: "view.deps", title: "Go to: Dependencies", run: () => d.showView("deps") },
            { id: "view.insights", title: "Go to: Insights", run: () => d.showView("insights") },
            { id: "view.problems", title: "Go to: Problems", run: () => d.showView("problems") },
            { id: "view.hierarchy", title: "Go to: Hierarchy", run: () => d.showView("hierarchy") },
            { id: "callhierarchy.show", title: "Call Hierarchy", run: d.showCallHierarchy },
            { id: "usages.find", title: "Find Usages", run: d.showFindUsages },
            { id: "view.events", title: "Go to: Events", run: () => d.showView("events") },
            { id: "view.sync", title: "Go to: Sync", run: () => d.showView("sync") },
            { id: "view.runtime", title: "Go to: Runtime", run: () => d.showView("runtime") },
            { id: "view.watches", title: "Go to: Watches", run: () => d.showView("watches") },
            { id: "view.logpoints", title: "Go to: Logpoints", run: () => d.showView("logpoints") },
            { id: "view.toolchain", title: "Go to: Toolchain", run: () => d.showView("toolchain") },
            { id: "settings.open", title: "Settings: Open", run: () => d.setSettingsOpen(true) },
        ],
        [
            d.backend, d.port, d.status, d.startSync, d.stopSync, d.build, d.test,
            d.testCommand, d.runTests, d.clearRuntime, d.toggle, d.showView, d.activeFile,
            d.toasts, d.showCallHierarchy, d.showFindUsages, d.openPalette,
        ],
    );
}
