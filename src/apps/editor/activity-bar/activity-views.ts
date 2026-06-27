import { IconType } from "react-icons";
import { FaRegFolder } from "react-icons/fa";
import { IoSyncOutline } from "react-icons/io5";
import {
    VscTools,
    VscListTree,
    VscReferences,
    VscRadioTower,
    VscPulse,
    VscSearch,
    VscTypeHierarchy,
    VscCallIncoming,
    VscSymbolClass,
    VscListSelection,
    VscTerminal,
    VscDatabase,
    VscChecklist,
    VscEye,
    VscDebugAlt,
    VscLightbulb,
    VscWarning,
    VscBeaker,
    VscGitMerge,
    VscPackage,
    VscDashboard,
} from "react-icons/vsc";

export type ActivityViewId =
    | "project"
    | "search"
    | "git"
    | "todo"
    | "structure"
    | "datamodel"
    | "deps"
    | "packages"
    | "insights"
    | "problems"
    | "tests"
    | "hierarchy"
    | "callhierarchy"
    | "usages"
    | "events"
    | "sync"
    | "runtime"
    | "profiler"
    | "state"
    | "watches"
    | "logpoints"
    | "toolchain"
    | "terminal";

export type ActivityView = {
    id: ActivityViewId;
    label: string;
    icon: IconType;
};

export const ACTIVITY_VIEWS: ActivityView[] = [
    {
        id: "project",
        label: "Project",
        icon: FaRegFolder,
    },
    {
        id: "search",
        label: "Search",
        icon: VscSearch,
    },
    {
        id: "git",
        label: "Git",
        icon: VscGitMerge,
    },
    {
        id: "todo",
        label: "TODO",
        icon: VscChecklist,
    },
    {
        id: "structure",
        label: "Structure",
        icon: VscSymbolClass,
    },
    {
        id: "datamodel",
        label: "DataModel",
        icon: VscListTree,
    },
    {
        id: "deps",
        label: "Dependencies",
        icon: VscReferences,
    },
    {
        id: "packages",
        label: "Packages",
        icon: VscPackage,
    },
    {
        id: "insights",
        label: "Insights",
        icon: VscLightbulb,
    },
    {
        id: "problems",
        label: "Problems",
        icon: VscWarning,
    },
    {
        id: "tests",
        label: "Tests",
        icon: VscBeaker,
    },
    {
        id: "hierarchy",
        label: "Hierarchy",
        icon: VscTypeHierarchy,
    },
    {
        id: "callhierarchy",
        label: "Call Hierarchy",
        icon: VscCallIncoming,
    },
    {
        id: "usages",
        label: "Usages",
        icon: VscListSelection,
    },
    {
        id: "events",
        label: "Events",
        icon: VscRadioTower,
    },
    {
        id: "sync",
        label: "Sync",
        icon: IoSyncOutline,
    },
    {
        id: "runtime",
        label: "Runtime",
        icon: VscPulse,
    },
    {
        id: "profiler",
        label: "Profiler",
        icon: VscDashboard,
    },
    {
        id: "state",
        label: "State",
        icon: VscDatabase,
    },
    {
        id: "watches",
        label: "Watches",
        icon: VscEye,
    },
    {
        id: "logpoints",
        label: "Logpoints",
        icon: VscDebugAlt,
    },
    {
        id: "toolchain",
        label: "Toolchain",
        icon: VscTools,
    },
    {
        id: "terminal",
        label: "Terminal",
        icon: VscTerminal,
    },
];

export const DEFAULT_ACTIVITY_VIEW: ActivityViewId = "project";