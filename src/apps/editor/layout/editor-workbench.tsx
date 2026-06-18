import { type PointerEvent, type ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import styles from "../editor.module.scss";
import { VscSettingsGear } from "react-icons/vsc";
import Dock from "./dock";
import DockStripe from "./dock-stripe";
import DropOverlay from "./drop-overlay";
import ActivityButton from "../activity-bar/activity-button";
import { useLayout } from "./use-layout";
import { useDockDrag } from "./use-dock-drag";
import { type ToolId, regionId } from "./layout-types";

type DockDeps = {
    activeIn: (r: ReturnType<typeof regionId>) => ToolId | undefined;
    renderTool: (t: ToolId) => ReactNode;
    onGripDown: (t: ToolId, e: PointerEvent) => void;
};

type Props = {
    layout: ReturnType<typeof useLayout>;
    dockDrag: ReturnType<typeof useDockDrag>;
    dockDeps: DockDeps;
    stripeDown: (t: ToolId, e: PointerEvent) => void;
    onOpenSettings: () => void;
    center: ReactNode;
};

export default function EditorWorkbench({
    layout,
    dockDrag,
    dockDeps,
    stripeDown,
    onOpenSettings,
    center,
}: Props) {
    const leftSlots = layout.openSlots("left");
    const rightSlots = layout.openSlots("right");
    const bottomSlots = layout.openSlots("bottom");

    return (
        <div className={styles.body} style={{ position: "relative" }}>
            <DockStripe
                dock="left"
                tools={layout.toolsInDock("left")}
                isOpen={layout.isOpen}
                onPointerDown={stripeDown}
                footer={
                    <ActivityButton
                        icon={VscSettingsGear}
                        label="Settings"
                        active={false}
                        onClick={onOpenSettings}
                    />
                }
            />

            <Group
                orientation="horizontal"
                className={styles.panels}
                resizeTargetMinimumSize={{ coarse: 20, fine: 12 }}
            >
                {leftSlots.length > 0 && (
                    <Panel collapsible defaultSize="260px" minSize="180px">
                        <Dock dock="left" openSlots={leftSlots} {...dockDeps} />
                    </Panel>
                )}
                {leftSlots.length > 0 && <Separator className={styles.handle} />}

                <Panel className={styles.main}>
                    <Group orientation="vertical" className={styles.mainGroup}>
                        <Panel className={styles.editorPane}>{center}</Panel>

                        {bottomSlots.length > 0 && <Separator className={styles.vHandle} />}
                        {bottomSlots.length > 0 && (
                            <Panel collapsible defaultSize="30%" minSize="20%">
                                <Dock dock="bottom" openSlots={bottomSlots} {...dockDeps} />
                            </Panel>
                        )}
                    </Group>
                </Panel>

                {rightSlots.length > 0 && <Separator className={styles.handle} />}
                {rightSlots.length > 0 && (
                    <Panel collapsible defaultSize="260px" minSize="180px">
                        <Dock dock="right" openSlots={rightSlots} {...dockDeps} />
                    </Panel>
                )}
            </Group>

            <DockStripe
                dock="right"
                tools={layout.toolsInDock("right")}
                isOpen={layout.isOpen}
                onPointerDown={stripeDown}
            />

            {dockDrag.dragTool && <DropOverlay hot={dockDrag.hot} />}
        </div>
    );
}
