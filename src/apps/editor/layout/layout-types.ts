import { ACTIVITY_VIEWS, type ActivityViewId } from "../activity-bar/activity-views";

export type Dock = "left" | "right" | "bottom";
export type Slot = "a" | "b"; // two stackable regions per dock = split
export type ToolId = ActivityViewId;
export type RegionId = `${Dock}.${Slot}`;
export type Placement = { dock: Dock; slot: Slot };

export type LayoutState = {
    placement: Record<ToolId, Placement>;
    // visible tool per region; absent = region collapsed.
    active: Partial<Record<RegionId, ToolId>>;
};

export const DOCKS: Dock[] = ["left", "right", "bottom"];
export const SLOTS: Slot[] = ["a", "b"];
export const ALL_TOOLS: ToolId[] = ACTIVITY_VIEWS.map((v) => v.id);

export const regionId = (dock: Dock, slot: Slot): RegionId => `${dock}.${slot}`;

const BOTTOM_TOOLS: ToolId[] = ["runtime", "terminal"];
const RIGHT_TOOLS: ToolId[] = ["state"];

const defaultDock = (id: ToolId): Placement => {
    if (BOTTOM_TOOLS.includes(id)) return { dock: "bottom", slot: "a" };
    if (RIGHT_TOOLS.includes(id)) return { dock: "right", slot: "a" };
    return { dock: "left", slot: "a" };
};

export const DEFAULT_LAYOUT: LayoutState = {
    placement: Object.fromEntries(
        ALL_TOOLS.map((id) => [id, defaultDock(id)])
    ) as Record<ToolId, Placement>,
    active: { "left.a": "project" },
};

// Fill in any tool missing from a saved layout (e.g. a newly added tool window).
export function withDefaults(saved: Partial<LayoutState>): LayoutState {
    const placement = { ...DEFAULT_LAYOUT.placement, ...(saved.placement ?? {}) };
    return { placement, active: saved.active ?? { ...DEFAULT_LAYOUT.active } };
}
