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
    testEz: string | null;
    testRoots: string[];
    buildOutput: string | null;
};

export type TestRun = { code: number; output: string };

export function runProjectTest(): Promise<TestRun> {
    return invoke("project_run_test");
}

// TestEZ result tree, posted back by the Studio bridge plugin (type "testResults").
export type TestNode = {
    phrase: string;
    nodeType: string;
    status: string; // "Success" | "Failure" | "Skipped"
    errors: string[];
    children: TestNode[];
};
export type TestResults = {
    successCount?: number;
    failureCount?: number;
    skippedCount?: number;
    errors?: string[];
    children?: TestNode[];
    error?: string; // config/require/run failure, before any test ran
};

export type TestezSetup = { log: string; specFile: string | null };

export function setupTestez(): Promise<TestezSetup> {
    return invoke("project_setup_testez");
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

export type CalleeSite = {
    callee: string;
    file: string;
    line: number;
    column: number;
};

export function calleesOf(name: string): Promise<CalleeSite[]> {
    return invoke("project_callees", { name });
}

export type ProjectSymbol = {
    name: string;
    container: string;
    file: string;
    line: number;
    column: number;
};

export function projectSymbols(query: string): Promise<ProjectSymbol[]> {
    return invoke("project_symbols", { query });
}

export type Usage = {
    file: string;
    line: number;
    column: number;
    text: string;
    call: boolean;
};

export function memberUsages(
    fromFile: string,
    receiver: string,
    member: string
): Promise<Usage[]> {
    return invoke("project_member_usages", { fromFile, receiver, member });
}

export type TodoItem = {
    tag: string;
    file: string;
    line: number;
    column: number;
    text: string;
};

export function projectTodos(): Promise<TodoItem[]> {
    return invoke("project_todos");
}

export function runtimeEnqueue(command: object): Promise<void> {
    return invoke("runtime_enqueue", { command: JSON.stringify(command) });
}

export type LogpointArg = {
    file: string;
    line: number;
    expr: string;
    includeStack: boolean;
};

export function logpointsArm(points: LogpointArg[]): Promise<void> {
    return invoke("logpoints_arm", { points });
}

export function logpointsDisarm(): Promise<void> {
    return invoke("logpoints_disarm");
}

export function clientAgentInstall(): Promise<void> {
    return invoke("client_agent_install");
}

export function clientAgentRemove(): Promise<void> {
    return invoke("client_agent_remove");
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

export type InsightFinding = {
    severity: string;
    category: string;
    message: string;
    file: string;
    line: number;
};

export type Insights = { findings: InsightFinding[] };

export function getProjectInsights(): Promise<Insights | null> {
    return invoke("project_insights");
}

export function projectRequirers(file: string): Promise<string[]> {
    return invoke("project_requirers", { file });
}

export function organizeRequires(file: string): Promise<string | null> {
    return invoke("project_organize_requires", { file });
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
