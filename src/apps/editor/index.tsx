import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { join } from "@tauri-apps/api/path";
import * as monaco from "monaco-editor";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Group, Panel, Separator } from "react-resizable-panels";
import styles from "./editor.module.scss";
import ActivityBar from "./activity-bar/activity-bar";
import { useActivityView } from "./activity-bar/use-activity-view";
import Sidebar from "./file-tree/sidebar";
import { useSidebarPanel } from "./file-tree/use-sidebar-panel";
import SearchPalette from "./search/search-palette";
import { useCommandPalette } from "./search/use-command-palette";
import { type Command } from "./search/commands";
import { BINDABLE, keybindKey, chordFromEvent } from "./settings/keybinds";
import {
    readSettings,
    subscribeSettings,
    type SettingsValues,
} from "../../lib/settings";
import { checkForUpdate } from "../../lib/update-check";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import EditorTabs from "./code-editor/editor-tabs";
import EditorPane from "./code-editor/editor-pane";
import { useOpenFiles } from "./code-editor/use-open-files";
import { useLuauLsp } from "./code-editor/luau-lsp/use-luau-lsp";
import { useSourcemap } from "./code-editor/luau-lsp/use-sourcemap";
import { pathToUri, uriToPath } from "./code-editor/luau-lsp/uri";
import SyncPanel from "./sync/sync-panel";
import { useSyncServer } from "./sync/use-sync-server";
import RuntimePanel from "./runtime/runtime-panel";
import { useRuntimeBridge } from "./runtime/use-runtime-bridge";
import Toasts from "./notifications/toasts";
import { useToasts } from "./notifications/use-toasts";
import { useBuild } from "./build/use-build";
import { useTest } from "./build/use-test";
import FindPanel from "./find/find-panel";
import HierarchyPanel from "./hierarchy/hierarchy-panel";
import RenameDialog from "./refactor/rename-dialog";
import { makeResolver } from "./runtime/resolve-instance";
import { extractDiagnostics } from "./runtime/diagnostics";
import { useRuntimeMarkers } from "./runtime/use-runtime-markers";
import { useDataModel } from "./data-model/use-data-model";
import ToolchainPanel from "./toolchain/toolchain-panel";
import { useRokit } from "./toolchain/use-rokit";
import DataModelPanel from "./data-model/data-model-panel";
import DependenciesPanel from "./dependencies/dependencies-panel";
import EventsPanel from "./events/events-panel";
import TerminalView from "./terminal/terminal-view";
import { useTerminalPanel } from "./terminal/use-terminal-panel";
import SettingsView from "./settings/settings-view";
import StatusBar from "./status-bar/status-bar";
import { ProjectProvider, useProject } from "../../lib/project";

type Props = {
    path: string;
};

export default function Editor({ path }: Props) {
    return (
        <ProjectProvider root={path}>
            <EditorBody path={path} />
        </ProjectProvider>
    );
}

function EditorBody({ path }: Props) {
    const { currentView, toggleView, showView } = useActivityView();
    const sidebarRef = useSidebarPanel(currentView);
    const palette = useCommandPalette();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const sync = useSyncServer(path);
    const runtime = useRuntimeBridge();
    const toolchain = useRokit(path);
    const toasts = useToasts();
    const { build } = useBuild(path, sync.backend, toasts);
    const { test } = useTest(toasts);
    const project = useProject();
    const terminal = useTerminalPanel();

    // Surface sourcemap generation failures — without the sourcemap, DataModel
    // and runtime remap silently break.
    const sourcemapToast = useRef<number | null>(null);
    useSourcemap(path, (detail) => {
        if (sourcemapToast.current !== null) toasts.dismiss(sourcemapToast.current);
        sourcemapToast.current = toasts.push(
            "error",
            "Sourcemap generation failed",
            detail,
        );
    });
    useLuauLsp(path);
    const {
        openFiles,
        activeFile,
        setActiveFile,
        openFile,
        closeFile,
        reorderFiles,
    } = useOpenFiles();

    // Remap a Studio stack location (instance path + line) to the owned source
    // file, open it, and jump to the line. The editor instance is captured on
    // mount so we can reveal the line once Monaco has swapped to the new model.
    const { tree } = useDataModel(path);
    const resolve = useMemo(() => makeResolver(tree), [tree]);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    // Reveal a line once Monaco has swapped to the target model — right after
    // openFile the model may not be loaded yet, so poll a few frames.
    const revealLine = useCallback((uri: string, line: number, column = 1) => {
        const reveal = (attempt: number) => {
            const editor = editorRef.current;
            if (editor?.getModel()?.uri.toString() === uri) {
                editor.revealLineInCenter(line);
                editor.setPosition({ lineNumber: line, column });
                editor.focus();
            } else if (attempt < 60) {
                requestAnimationFrame(() => reveal(attempt + 1));
            }
        };
        reveal(0);
    }, []);

    const openLocation = useCallback(
        async (dotPath: string, line: number) => {
            const source = resolve(dotPath);
            if (!source) return;
            const abs = await join(path, ...source.split("/"));
            openFile(abs);
            revealLine(pathToUri(abs), line);
        },
        [resolve, path, openFile, revealLine],
    );

    // Open a project-search hit (relative path + line/column) and jump to it.
    const openFileAt = useCallback(
        async (relFile: string, line: number, column: number) => {
            const abs = await join(path, ...relFile.split("/"));
            openFile(abs);
            revealLine(pathToUri(abs), line, column);
        },
        [path, openFile, revealLine],
    );

    // Cross-file navigation for LSP go-to-definition / find-references: the
    // standalone Monaco can't open another file, so route its open requests
    // through Lunar's own openFile + reveal.
    useEffect(() => {
        const opener = monaco.editor.registerEditorOpener({
            openCodeEditor(_source, resource, selectionOrPosition) {
                const file = uriToPath(resource.toString());
                openFile(file);
                const line =
                    selectionOrPosition && "lineNumber" in selectionOrPosition
                        ? selectionOrPosition.lineNumber
                        : selectionOrPosition?.startLineNumber ?? 1;
                const column =
                    selectionOrPosition && "column" in selectionOrPosition
                        ? selectionOrPosition.column
                        : selectionOrPosition?.startColumn ?? 1;
                // Reveal against the model's canonical uri (pathToUri of the
                // path), not the raw LSP uri (which encodes the drive colon).
                revealLine(pathToUri(file), line, column);
                return true;
            },
        });
        return () => opener.dispose();
    }, [openFile, revealLine]);

    // Runtime errors become inline squiggles on the source line.
    const diagnostics = useMemo(
        () => extractDiagnostics(runtime.messages, resolve, path),
        [runtime.messages, resolve, path],
    );
    useRuntimeMarkers(diagnostics);

    // Command surface: actions on the project, surfaced in the palette (type ">").
    const commands = useMemo<Command[]>(
        () => [
            {
                id: "sync.start",
                title: "Sync: Start server",
                hint: `${sync.backend} · :${sync.port}`,
                enabled: sync.status !== "running",
                run: sync.start,
            },
            {
                id: "sync.stop",
                title: "Sync: Stop server",
                enabled: sync.status === "running",
                run: sync.stop,
            },
            {
                id: "build",
                title: "Build: Place file",
                hint: `${sync.backend} build`,
                run: build,
            },
            {
                id: "test",
                title: "Test: Run tests",
                hint: project?.testCommand ?? "set [test] command in lunar.toml",
                run: test,
            },
            { id: "runtime.clear", title: "Runtime: Clear output", run: runtime.clear },
            {
                id: "search.find",
                title: "Search: Find in Files",
                run: () => showView("search"),
            },
            {
                id: "refactor.renameModule",
                title: "Refactor: Rename module…",
                hint: activeFile ? undefined : "open a module first",
                run: () =>
                    activeFile
                        ? setRenaming(true)
                        : toasts.push("error", "Open a module file to rename it"),
            },
            { id: "terminal.toggle", title: "Terminal: Toggle", run: terminal.toggle },
            { id: "view.project", title: "Go to: Project", run: () => showView("project") },
            { id: "view.datamodel", title: "Go to: DataModel", run: () => showView("datamodel") },
            { id: "view.deps", title: "Go to: Dependencies", run: () => showView("deps") },
            { id: "view.hierarchy", title: "Go to: Hierarchy", run: () => showView("hierarchy") },
            { id: "view.events", title: "Go to: Events", run: () => showView("events") },
            { id: "view.sync", title: "Go to: Sync", run: () => showView("sync") },
            { id: "view.runtime", title: "Go to: Runtime", run: () => showView("runtime") },
            { id: "view.toolchain", title: "Go to: Toolchain", run: () => showView("toolchain") },
            { id: "settings.open", title: "Settings: Open", run: () => setSettingsOpen(true) },
        ],
        [sync.backend, sync.port, sync.status, sync.start, sync.stop, build, test, project?.testCommand, runtime.clear, terminal.toggle, showView, activeFile, toasts],
    );

    // Global keybindings: match a chord against the configured/default binding
    // and run the matching command. Refs keep the listener stable across renders.
    const settingsRef = useRef<SettingsValues>({});
    useEffect(() => {
        readSettings().then((v) => (settingsRef.current = v));
        return subscribeSettings((v) => (settingsRef.current = v));
    }, []);
    const commandsRef = useRef(commands);
    commandsRef.current = commands;
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const chord = chordFromEvent(e);
            if (!chord) return;
            for (const bindable of BINDABLE) {
                const bound =
                    (settingsRef.current[keybindKey(bindable.id)] as string) ||
                    bindable.defaultKey;
                if (bound && bound === chord) {
                    const command = commandsRef.current.find(
                        (c) => c.id === bindable.id,
                    );
                    if (command && command.enabled !== false) {
                        e.preventDefault();
                        command.run();
                    }
                    return;
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // On startup, offer to download a newer Lunar release (unless disabled).
    useEffect(() => {
        readSettings().then((values) => {
            if (values["lunar.checkForUpdates"] === false) return;
            checkForUpdate().then((info) => {
                if (!info) return;
                toasts.push(
                    "info",
                    `Lunar v${info.version} is available`,
                    "A newer version was published on GitHub.",
                    undefined,
                    {
                        label: "Download",
                        run: () => openExternal(info.url).catch(() => {}),
                    },
                );
            });
        });
    }, []);

    // Track which files have unsaved changes
    const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());

    // Cursor position from the active editor, shown in the status bar.
    const [cursor, setCursor] = useState<{
        line: number;
        column: number;
    } | null>(null);

    const handleDirtyChange = useCallback(
        (filePath: string, dirty: boolean) => {
            setDirtyFiles((prev) => {
                const hasDirty = prev.has(filePath);
                if (dirty === hasDirty) return prev;
                const next = new Set(prev);
                if (dirty) next.add(filePath);
                else next.delete(filePath);
                return next;
            });
        },
        [],
    );

    // Save only files the user actually edited. Writing every open model is
    // dangerous: a model that failed to load (or never loaded) holds "" and
    // would wipe the file on close. Dirty-only mirrors how editors like VS Code
    // behave and makes accidental data loss impossible.
    const dirtyFilesRef = useRef(dirtyFiles);
    dirtyFilesRef.current = dirtyFiles;

    const saveAll = useCallback(async () => {
        await Promise.all(
            [...dirtyFilesRef.current].map(async (filePath) => {
                const model = monaco.editor.getModel(
                    monaco.Uri.parse(pathToUri(filePath)),
                );
                if (!model) return;
                try {
                    await writeTextFile(filePath, model.getValue());
                } catch (e) {
                    // Don't let one failed write abort saving the others.
                    console.error("failed to save", filePath, e);
                }
            }),
        );
    }, []);

    // Save all dirty files before the window closes
    const saveAllRef = useRef(saveAll);
    saveAllRef.current = saveAll;

    // Stop the sync server before closing so its sidecar (Rojo/Argon) doesn't
    // get orphaned and keep holding its port.
    const stopSyncRef = useRef(sync.stop);
    stopSyncRef.current = sync.stop;

    useEffect(() => {
        const win = getCurrentWindow();
        let unlisten: (() => void) | undefined;
        win.onCloseRequested(async (event) => {
            event.preventDefault();
            // Best-effort save and sync shutdown: a failure in either must not
            // block the window from closing, so each is isolated and we always
            // reach destroy().
            try {
                await saveAllRef.current();
            } catch (e) {
                console.error("save on close failed", e);
            }
            try {
                await stopSyncRef.current();
            } catch (e) {
                console.error("sync stop on close failed", e);
            }
            // destroy() bypasses onCloseRequested (close() would re-enter this
            // handler and loop). If destroy ever fails, fall back to close() so
            // a single failure can't permanently trap the window open.
            try {
                await win.destroy();
            } catch (e) {
                console.error(
                    "window destroy failed, falling back to close",
                    e,
                );
                await win.close();
            }
        }).then((fn) => {
            unlisten = fn;
        });
        return () => unlisten?.();
    }, []);

    return (
        <div className={styles.editor}>
            <div className={styles.body}>
                <ActivityBar
                    active={currentView}
                    onSelect={toggleView}
                    terminalOpen={terminal.open}
                    onToggleTerminal={terminal.toggle}
                    onOpenSettings={() => setSettingsOpen(true)}
                />

                <Group
                    orientation="horizontal"
                    className={styles.panels}
                    resizeTargetMinimumSize={{ coarse: 20, fine: 12 }}
                >
                    <Panel
                        panelRef={sidebarRef}
                        collapsible
                        collapsedSize={0}
                        defaultSize="260px"
                        minSize="180px"
                    >
                        {currentView === "search" ? (
                            <FindPanel root={path} onOpenAt={openFileAt} />
                        ) : currentView === "sync" ? (
                            <SyncPanel
                                backend={sync.backend}
                                onBackendChange={sync.setBackend}
                                status={sync.status}
                                phase={sync.phase}
                                logs={sync.logs}
                                port={sync.port}
                                onPortChange={sync.setPort}
                                onStart={sync.start}
                                onStop={sync.stop}
                            />
                        ) : currentView === "toolchain" ? (
                            <ToolchainPanel
                                tools={toolchain.tools}
                                hasManifest={toolchain.hasManifest}
                                busy={toolchain.busy}
                                logs={toolchain.logs}
                                onInstall={toolchain.install}
                                onUpdate={toolchain.update}
                                onInit={toolchain.init}
                                onAdd={toolchain.add}
                                onRemove={toolchain.remove}
                                onSetVersion={toolchain.setVersion}
                            />
                        ) : currentView === "datamodel" ? (
                            <DataModelPanel
                                root={path}
                                activeFile={activeFile}
                                onOpenFile={openFile}
                            />
                        ) : currentView === "deps" ? (
                            <DependenciesPanel
                                root={path}
                                activeFile={activeFile}
                                onOpenFile={openFile}
                            />
                        ) : currentView === "hierarchy" ? (
                            <HierarchyPanel
                                root={path}
                                activeFile={activeFile}
                                onOpenFile={openFile}
                            />
                        ) : currentView === "events" ? (
                            <EventsPanel root={path} onOpenFile={openFile} />
                        ) : currentView === "runtime" ? (
                            <RuntimePanel
                                messages={runtime.messages}
                                running={runtime.running}
                                port={runtime.port}
                                playtest={runtime.playtest}
                                onClear={runtime.clear}
                                resolve={resolve}
                                onOpen={openLocation}
                            />
                        ) : (
                            <Sidebar
                                currentView={currentView}
                                path={path}
                                onOpenFile={openFile}
                            />
                        )}
                    </Panel>

                    {currentView && <Separator className={styles.handle} />}

                    <Panel className={styles.main}>
                        <Group
                            orientation="vertical"
                            className={styles.mainGroup}
                        >
                            <Panel className={styles.editorPane}>
                                <EditorTabs
                                    files={openFiles}
                                    active={activeFile}
                                    dirtyFiles={dirtyFiles}
                                    onSelect={setActiveFile}
                                    onClose={closeFile}
                                    onReorder={reorderFiles}
                                />
                                <div className={styles.editorArea}>
                                    <EditorPane
                                        path={activeFile}
                                        onDirtyChange={handleDirtyChange}
                                        onCursorChange={setCursor}
                                        onReady={(editor) =>
                                            (editorRef.current = editor)
                                        }
                                    />
                                </div>
                            </Panel>

                            {terminal.open && (
                                <Separator className={styles.vHandle} />
                            )}

                            <Panel
                                panelRef={terminal.ref}
                                collapsible
                                collapsedSize={0}
                                defaultSize="30%"
                                minSize="20%"
                            >
                                <TerminalView
                                    cwd={path}
                                    onClose={terminal.close}
                                />
                            </Panel>
                        </Group>
                    </Panel>
                </Group>
            </div>

            <StatusBar
                status={sync.status}
                backend={sync.backend}
                phase={sync.phase}
                port={sync.port}
                cursor={cursor}
                onClick={() => toggleView("sync")}
            />

            {palette.isOpen && (
                <SearchPalette
                    path={path}
                    commands={commands}
                    initialQuery={palette.initialQuery}
                    onClose={palette.close}
                    onOpen={(file) => openFile(file.path)}
                />
            )}

            {settingsOpen && (
                <SettingsView onClose={() => setSettingsOpen(false)} />
            )}

            {renaming && activeFile && (
                <RenameDialog
                    root={path}
                    activeFile={activeFile}
                    onClose={() => setRenaming(false)}
                    onDone={(newAbs) => {
                        setRenaming(false);
                        const old = activeFile;
                        openFile(newAbs);
                        if (old) closeFile(old);
                        toasts.push(
                            "success",
                            `Renamed to ${newAbs.split(/[\\/]/).pop()}`,
                            undefined,
                            5000,
                        );
                    }}
                />
            )}

            <Toasts toasts={toasts.toasts} onDismiss={toasts.dismiss} />
        </div>
    );
}
