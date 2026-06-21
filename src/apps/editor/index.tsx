import { useState, useRef, useMemo, useEffect, type ReactNode, type PointerEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import * as monaco from "monaco-editor";
import styles from "./editor.module.scss";
import { useLayout } from "./layout/use-layout";
import { useDockDrag } from "./layout/use-dock-drag";
import DockStripe from "./layout/dock-stripe";
import EditorWorkbench from "./layout/editor-workbench";
import ToolWindow from "./layout/tool-window";
import type { ToolId } from "./layout/layout-types";
import EditorTabs from "./code-editor/editor-tabs";
import EditorPane from "./code-editor/editor-pane";
import { useOpenFiles } from "./code-editor/use-open-files";
import { useLuauLsp } from "./code-editor/luau-lsp/use-luau-lsp";
import { useEditorNavigation } from "./code-editor/use-editor-navigation";
import { useUnsavedFiles } from "./code-editor/use-unsaved-files";
import { useWindowClose } from "./code-editor/use-window-close";
import { useRenameNode } from "./code-editor/use-rename-node";
import { useSyncServer } from "./sync/use-sync-server";
import { useRuntimeBridge } from "./runtime/use-runtime-bridge";
import { useStateInspector } from "./runtime/use-state-inspector";
import { useEvalWatches } from "./runtime/use-eval-watches";
import { useLogpoints } from "./runtime/use-logpoints";
import { toRelative } from "./data-model/instance-path";
import { makeResolver } from "./runtime/resolve-instance";
import { extractDiagnostics } from "./runtime/diagnostics";
import { useRuntimeMarkers } from "./runtime/use-runtime-markers";
import { useToasts } from "./notifications/use-toasts";
import { useBuild } from "./build/use-build";
import { useTest } from "./build/use-test";
import { useCommandPalette } from "./search/use-command-palette";
import { useEditorCommands } from "./search/use-editor-commands";
import { useGlobalKeybindings } from "./settings/use-global-keybindings";
import { useUpdateCheck } from "../../lib/use-update-check";
import { useRokit } from "./toolchain/use-rokit";
import { useDataModel } from "./data-model/use-data-model";
import StatusBar from "./status-bar/status-bar";
import EditorOverlays from "./editor-overlays";
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
    const layout = useLayout();
    const showView = layout.open;
    const toggleView = layout.toggle;
    const dockDrag = useDockDrag(layout.place);
    const palette = useCommandPalette();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [cursor, setCursor] = useState<{ line: number; column: number } | null>(null);

    const sync = useSyncServer(path);
    const runtime = useRuntimeBridge();
    const stateInspector = useStateInspector();
    const evalWatches = useEvalWatches();
    const logpoints = useLogpoints();
    const toolchain = useRokit(path);
    const toasts = useToasts();
    const { build } = useBuild(path, sync.backend, toasts);
    const { test } = useTest(toasts);
    const project = useProject();

    // Strip any logpoint prints / client agent left in source by a previous
    // session or crash, once the project is open. Keeps the tree clean.
    useEffect(() => {
        if (project) {
            logpoints.disarm().catch(() => {});
            invoke("client_agent_remove").catch(() => {});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project?.root]);

    useLuauLsp(path);

    const {
        openFiles, activeFile, setActiveFile, openFile, closeFile, renameFile, reorderFiles,
    } = useOpenFiles();
    const renameNode = useRenameNode(path, renameFile);

    const { tree } = useDataModel(path);
    const resolve = useMemo(() => makeResolver(tree), [tree]);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    // Logpoint glyphs for the active file.
    const activeRel = activeFile ? toRelative(path, activeFile) : null;
    const logpointLines = useMemo(
        () =>
            activeRel
                ? logpoints.points.filter((p) => p.file === activeRel).map((p) => p.line)
                : [],
        [activeRel, logpoints.points],
    );
    const removeLogpointLine = (line: number) => {
        const p = logpoints.points.find((q) => q.file === activeRel && q.line === line);
        if (p) logpoints.remove(p.id);
    };

    const nav = useEditorNavigation({
        path, activeFile, resolve, openFile, editorRef, showView, toasts,
    });

    // Runtime errors become inline squiggles on the source line.
    const diagnostics = useMemo(
        () => extractDiagnostics(runtime.messages, resolve, path),
        [runtime.messages, resolve, path],
    );
    useRuntimeMarkers(diagnostics);

    const commands = useEditorCommands({
        backend: sync.backend,
        port: sync.port,
        status: sync.status,
        startSync: sync.start,
        stopSync: sync.stop,
        build,
        test,
        testCommand: project?.testCommand,
        clearRuntime: runtime.clear,
        openPalette: palette.open,
        toggle: layout.toggle,
        showView,
        activeFile,
        toasts,
        setRenaming,
        setSettingsOpen,
        showCallHierarchy: nav.showCallHierarchy,
        showFindUsages: nav.showFindUsages,
    });
    useGlobalKeybindings(commands);
    useUpdateCheck(toasts);

    const { dirtyFiles, handleDirtyChange, saveAll } = useUnsavedFiles();
    useWindowClose(saveAll, sync.stop);

    // Logpoints arm/disarm automatically around a play-test: inject the prints
    // right before Play, strip them on Stop — so the user never arms by hand and
    // the source stays clean except while actually running.
    const studioPlay = async (stop: boolean) => {
        try {
            if (!stop) {
                if (logpoints.points.length) await logpoints.arm();
                // Plant the client log agent so the play-test client streams its
                // own output (the plugin can't see the client VM). Best-effort.
                await invoke("client_agent_install").catch(() => {});
            }
            await invoke("studio_play", { stop });
            if (stop) {
                if (logpoints.armed) await logpoints.disarm();
                await invoke("client_agent_remove").catch(() => {});
            }
        } catch (e) {
            toasts.push("error", stop ? "Stop failed" : "Play failed", String(e));
        }
    };

    const renderTool = (id: ToolId): ReactNode => (
        <ToolWindow
            id={id}
            path={path}
            activeFile={activeFile}
            openFile={openFile}
            openFileAt={nav.openFileAt}
            openLocation={nav.openLocation}
            goToLine={nav.goToLine}
            resolve={resolve}
            sync={sync}
            toolchain={toolchain}
            runtime={runtime}
            stateInspector={stateInspector}
            evalWatches={evalWatches}
            logpoints={logpoints}
            callTarget={nav.callTarget}
            usageTarget={nav.usageTarget}
            renameNode={renameNode}
            onToggleTerminal={() => layout.toggle("terminal")}
            onStudioPlay={studioPlay}
        />
    );

    const stripeDown = (t: ToolId, e: PointerEvent) =>
        dockDrag.onPointerDown(t, e, () => toggleView(t));

    const dockDeps = {
        activeIn: layout.activeIn,
        renderTool,
        onGripDown: (t: ToolId, e: PointerEvent) => dockDrag.onPointerDown(t, e),
    };

    return (
        <div className={styles.editor}>
            <EditorWorkbench
                layout={layout}
                dockDrag={dockDrag}
                dockDeps={dockDeps}
                stripeDown={stripeDown}
                onOpenSettings={() => setSettingsOpen(true)}
                center={
                    <>
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
                                onReady={(editor) => (editorRef.current = editor)}
                                onAddWatch={(expr) => {
                                    evalWatches.add(expr);
                                    showView("watches");
                                }}
                                onAddLogpoint={(line, expr) => {
                                    if (!activeFile) return;
                                    logpoints.add(toRelative(path, activeFile), line, expr);
                                    showView("logpoints");
                                }}
                                logpointLines={logpointLines}
                                onRemoveLogpointLine={removeLogpointLine}
                            />
                        </div>
                    </>
                }
            />

            <DockStripe
                dock="bottom"
                tools={layout.toolsInDock("bottom")}
                isOpen={layout.isOpen}
                onPointerDown={stripeDown}
            />

            <StatusBar
                status={sync.status}
                backend={sync.backend}
                phase={sync.phase}
                port={sync.port}
                cursor={cursor}
                onClick={() => toggleView("sync")}
            />

            <EditorOverlays
                path={path}
                palette={palette}
                commands={commands}
                openFile={openFile}
                openFileAt={nav.openFileAt}
                settingsOpen={settingsOpen}
                onCloseSettings={() => setSettingsOpen(false)}
                renaming={renaming}
                activeFile={activeFile}
                onCloseRename={() => setRenaming(false)}
                renameFile={renameFile}
                toasts={toasts}
            />
        </div>
    );
}
