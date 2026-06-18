import { type PointerEvent, type ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import styles from "./layout.module.scss";
import editor from "../editor.module.scss";
import { regionId, type Dock as DockId, type Slot } from "./layout-types";
import type { ToolId } from "./layout-types";

// Height of a tool window's own header — the strip that acts as the drag handle.
const HEADER_H = 38;

type RegionDeps = {
    activeIn: (r: ReturnType<typeof regionId>) => ToolId | undefined;
    renderTool: (t: ToolId) => ReactNode;
    onGripDown: (t: ToolId, e: PointerEvent) => void;
};

type Props = RegionDeps & {
    dock: DockId;
    openSlots: Slot[];
};

function Region({
    dock,
    slot,
    activeIn,
    renderTool,
    onGripDown,
}: RegionDeps & { dock: DockId; slot: Slot }) {
    const tool = activeIn(regionId(dock, slot));
    if (!tool) return null;

    // Start a move only from the panel's own header strip, and never when the
    // press lands on a control there (so header buttons keep working).
    const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (e.clientY - rect.top > HEADER_H) return;
        if ((e.target as HTMLElement).closest("button, input, textarea, a, select")) return;
        onGripDown(tool, e);
    };

    return (
        <div className={styles.region} onPointerDown={onPointerDown}>
            {renderTool(tool)}
        </div>
    );
}

export default function Dock({ dock, openSlots, ...deps }: Props) {
    if (openSlots.length <= 1) {
        return <Region dock={dock} slot={openSlots[0] ?? "a"} {...deps} />;
    }

    // Split: left/right stack vertically (a over b); bottom splits horizontally.
    const orientation = dock === "bottom" ? "horizontal" : "vertical";
    const handle = dock === "bottom" ? editor.handle : editor.vHandle;

    return (
        <Group orientation={orientation} style={{ height: "100%" }}>
            <Panel minSize="15%">
                <Region dock={dock} slot="a" {...deps} />
            </Panel>
            <Separator className={handle} />
            <Panel minSize="15%">
                <Region dock={dock} slot="b" {...deps} />
            </Panel>
        </Group>
    );
}
