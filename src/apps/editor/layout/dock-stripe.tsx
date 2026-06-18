import { type PointerEvent, type ReactNode } from "react";
import styles from "./layout.module.scss";
import { ACTIVITY_VIEWS } from "../activity-bar/activity-views";
import type { Dock, ToolId } from "./layout-types";

const META = Object.fromEntries(ACTIVITY_VIEWS.map((v) => [v.id, v])) as Record<
    ToolId,
    (typeof ACTIVITY_VIEWS)[number]
>;

type Props = {
    dock: Dock;
    tools: ToolId[];
    isOpen: (t: ToolId) => boolean;
    onPointerDown: (t: ToolId, e: PointerEvent) => void;
    footer?: ReactNode;
};

export default function DockStripe({ dock, tools, isOpen, onPointerDown, footer }: Props) {
    const horizontal = dock === "bottom";
    if (tools.length === 0 && !footer) return null;

    return (
        <div className={`${styles.stripe} ${horizontal ? styles.stripeH : styles.stripeV}`}>
            {tools.map((t) => {
                const Icon = META[t].icon;
                return (
                    <button
                        key={t}
                        className={`${styles.stripeBtn} ${isOpen(t) ? styles.stripeBtnActive : ""}`}
                        title={META[t].label}
                        aria-label={META[t].label}
                        onPointerDown={(e) => onPointerDown(t, e)}
                    >
                        <Icon size={20} />
                    </button>
                );
            })}
            {footer && (
                <>
                    <div className={styles.spacer} />
                    {footer}
                </>
            )}
        </div>
    );
}
