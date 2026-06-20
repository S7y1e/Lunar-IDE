import { type ReactNode } from "react";
import { type ToolId } from "./layout-types";
import Sidebar from "../file-tree/sidebar";
import FindPanel from "../find/find-panel";
import TodoPanel from "../todo/todo-panel";
import StructurePanel from "../structure/structure-panel";
import SyncPanel from "../sync/sync-panel";
import ToolchainPanel from "../toolchain/toolchain-panel";
import DataModelPanel from "../data-model/data-model-panel";
import DependenciesPanel from "../dependencies/dependencies-panel";
import HierarchyPanel from "../hierarchy/hierarchy-panel";
import CallHierarchyPanel, { type CallTarget } from "../callhierarchy/call-hierarchy-panel";
import UsagesPanel, { type UsageTarget } from "../usages/usages-panel";
import EventsPanel from "../events/events-panel";
import RuntimePanel from "../runtime/runtime-panel";
import StatePanel from "../runtime/state-panel";
import TerminalView from "../terminal/terminal-view";
import { type useSyncServer } from "../sync/use-sync-server";
import { type useRokit } from "../toolchain/use-rokit";
import { type useRuntimeBridge } from "../runtime/use-runtime-bridge";
import { type useStateInspector } from "../runtime/use-state-inspector";
import { type FileNode } from "../../../lib/filesystem";

type Props = {
    id: ToolId;
    path: string;
    activeFile: string | null;
    openFile: (abs: string) => void;
    openFileAt: (relFile: string, line: number, column: number) => void;
    openLocation: (dotPath: string, line: number) => void;
    goToLine: (line: number, column: number) => void;
    resolve: (dotPath: string) => string | null;
    sync: ReturnType<typeof useSyncServer>;
    toolchain: ReturnType<typeof useRokit>;
    runtime: ReturnType<typeof useRuntimeBridge>;
    stateInspector: ReturnType<typeof useStateInspector>;
    callTarget: CallTarget | null;
    usageTarget: UsageTarget | null;
    renameNode: (node: FileNode, newName: string) => Promise<string | null>;
    onToggleTerminal: () => void;
    onStudioPlay: (stop: boolean) => void;
};

// Render a tool window's content by id — keyed by tool so any tool can dock anywhere.
export default function ToolWindow(p: Props): ReactNode {
    switch (p.id) {
        case "search":
            return <FindPanel root={p.path} onOpenAt={p.openFileAt} />;
        case "todo":
            return <TodoPanel root={p.path} onOpenAt={p.openFileAt} />;
        case "structure":
            return <StructurePanel activeFile={p.activeFile} onGoTo={p.goToLine} />;
        case "sync":
            return (
                <SyncPanel
                    backend={p.sync.backend}
                    onBackendChange={p.sync.setBackend}
                    status={p.sync.status}
                    phase={p.sync.phase}
                    logs={p.sync.logs}
                    port={p.sync.port}
                    onPortChange={p.sync.setPort}
                    onStart={p.sync.start}
                    onStop={p.sync.stop}
                />
            );
        case "toolchain":
            return (
                <ToolchainPanel
                    tools={p.toolchain.tools}
                    hasManifest={p.toolchain.hasManifest}
                    busy={p.toolchain.busy}
                    logs={p.toolchain.logs}
                    onInstall={p.toolchain.install}
                    onUpdate={p.toolchain.update}
                    onInit={p.toolchain.init}
                    onAdd={p.toolchain.add}
                    onRemove={p.toolchain.remove}
                    onSetVersion={p.toolchain.setVersion}
                />
            );
        case "datamodel":
            return <DataModelPanel root={p.path} activeFile={p.activeFile} onOpenFile={p.openFile} />;
        case "deps":
            return <DependenciesPanel root={p.path} activeFile={p.activeFile} onOpenFile={p.openFile} />;
        case "hierarchy":
            return <HierarchyPanel root={p.path} activeFile={p.activeFile} onOpenFile={p.openFile} />;
        case "callhierarchy":
            return <CallHierarchyPanel target={p.callTarget} onOpen={p.openFileAt} />;
        case "usages":
            return <UsagesPanel target={p.usageTarget} onOpenAt={p.openFileAt} />;
        case "events":
            return <EventsPanel root={p.path} onOpenFile={p.openFile} />;
        case "runtime":
            return (
                <RuntimePanel
                    messages={p.runtime.messages}
                    running={p.runtime.running}
                    port={p.runtime.port}
                    playtest={p.runtime.playtest}
                    onClear={p.runtime.clear}
                    onPlay={p.onStudioPlay}
                    resolve={p.resolve}
                    onOpen={p.openLocation}
                />
            );
        case "state":
            return (
                <StatePanel
                    watches={p.stateInspector.watches}
                    running={p.runtime.running}
                    port={p.runtime.port}
                    playtest={p.runtime.playtest}
                    onClear={p.stateInspector.clear}
                />
            );
        case "terminal":
            return <TerminalView cwd={p.path} onClose={p.onToggleTerminal} />;
        default:
            return (
                <Sidebar
                    currentView="project"
                    path={p.path}
                    onOpenFile={p.openFile}
                    onRename={p.renameNode}
                />
            );
    }
}
