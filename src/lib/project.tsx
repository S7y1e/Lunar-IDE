import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type ProjectSnapshot = {
    root: string;
    name: string;
    projectFile: string;
    syncBackend: string | null;
    testCommand: string | null;
    buildOutput: string | null;
};

export type TestRun = { code: number; output: string };

export function runProjectTest(): Promise<TestRun> {
    return invoke("project_run_test");
}

export type SearchMatch = {
    file: string;
    line: number;
    column: number;
    text: string;
};
export type SearchResults = { matches: SearchMatch[]; truncated: boolean };

export function searchProject(
    query: string,
    caseSensitive: boolean
): Promise<SearchResults | null> {
    return invoke("project_search", { query, caseSensitive });
}

export type CallerSite = {
    caller: string;
    file: string;
    line: number;
    column: number;
};

export function callersOf(name: string): Promise<CallerSite[]> {
    return invoke("project_callers", { name });
}

export function openProject(root: string): Promise<ProjectSnapshot> {
    return invoke("project_open", { root });
}

export function closeProject(): Promise<void> {
    return invoke("project_close");
}

export function getProjectSnapshot(): Promise<ProjectSnapshot | null> {
    return invoke("project_snapshot");
}

export type DataModelNode = {
    name: string;
    className: string;
    filePaths: string[];
    children: DataModelNode[];
};

export function getProjectDataModel(): Promise<DataModelNode | null> {
    return invoke("project_data_model");
}

export type DependencyEdge = { from: string; to: string };
export type UnresolvedRequire = { from: string; expr: string };

export type DependencyGraph = {
    edges: DependencyEdge[];
    unresolved: UnresolvedRequire[];
};

export function getProjectDependencies(): Promise<DependencyGraph | null> {
    return invoke("project_dependencies");
}

export type Signal = {
    id: string;
    label: string;
    kind: string;
    firedBy: string[];
    connectedBy: string[];
};

export type UnresolvedEvent = { from: string; expr: string; action: string };

export type EventGraph = {
    signals: Signal[];
    unresolved: UnresolvedEvent[];
};

export function getProjectEvents(): Promise<EventGraph | null> {
    return invoke("project_events");
}

const ProjectContext = createContext<ProjectSnapshot | null>(null);

export function ProjectProvider({
    root,
    children,
}: {
    root: string;
    children: ReactNode;
}) {
    const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);

    useEffect(() => {
        let active = true;
        const unlisteners: Array<() => void> = [];

        openProject(root).then((snap) => {
            if (active) setSnapshot(snap);
        });

        listen("project://changed", () => {
            getProjectSnapshot().then((snap) => {
                if (active && snap) setSnapshot(snap);
            });
        }).then((un) => unlisteners.push(un));

        return () => {
            active = false;
            unlisteners.forEach((un) => un());
            closeProject().catch(() => {});
        };
    }, [root]);

    return (
        <ProjectContext.Provider value={snapshot}>
            {children}
        </ProjectContext.Provider>
    );
}

export function useProject(): ProjectSnapshot | null {
    return useContext(ProjectContext);
}
