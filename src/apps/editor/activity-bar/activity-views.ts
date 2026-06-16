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
} from "react-icons/vsc";

export type ActivityViewId =
    | "project"
    | "search"
    | "datamodel"
    | "deps"
    | "events"
    | "sync"
    | "runtime"
    | "toolchain";

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
        id: "toolchain",
        label: "Toolchain",
        icon: VscTools,
    },
];

export const DEFAULT_ACTIVITY_VIEW: ActivityViewId = "project";