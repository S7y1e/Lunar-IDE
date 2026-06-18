import { useState, useRef, useMemo, type ReactNode, type PointerEvent } from "react";
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
import { useSourcemap } from "./code-editor/luau-lsp/use-sourcemap";
import { useEditorNavigation } from "./code-editor/use-editor-navigation";
import { useUnsavedFiles } from "./code-editor/use-unsaved-files";
import { useWindowClose } from "./code-editor/use-window-close";
import { useRenameNode } from "./code-editor/use-rename-node";
import { useSyncServer } from "./sync/use-sync-server";
import { useRuntimeBridge } from "./runtime/use-runtime-bridge";
import { useStateInspector } from "./runtime/use-state-inspector";
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
    const toolchain = useRokit(path);
    const toasts = useToasts();
    const { build } = useBuild(path, sync.backend, toasts);
    const { test } = useTest(toasts);
    const project = useProject();

    // Surface sourcemap failures — without it, DataModel and runtime remap break.
    const sourcemapToast = useRef<number | null>(null);
    useSourcemap(path, (detail) => {
        if (sourcemapToast.current !== null) toasts.dismiss(sourcemapToast.current);
        sourcemapToast.current = toasts.push("error", "Sourcemap generation failed", detail);
    });
    useLuauLsp(path);

    const {
        openFiles, activeFile, setActiveFile, openFile, closeFile, renameFile, reorderFiles,
    } = useOpenFiles();
    const renameNode = useRenameNode(path, renameFile);

    const { tree } = useDataModel(path);
    const resolve = useMemo(() => makeResolver(tree), [tree]);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

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
            callTarget={nav.callTarget}
            usageTarget={nav.usageTarget}
            renameNode={renameNode}
            onToggleTerminal={() => layout.toggle("terminal")}
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
