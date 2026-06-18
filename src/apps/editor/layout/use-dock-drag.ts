import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Dock, Slot, ToolId } from "./layout-types";

const THRESHOLD = 5; // px before a press becomes a drag instead of a click

// Pointer-based drag for tool windows. The Tauri webview swallows native HTML5
// drag/drop (drop never fires), so we track pointer move/up on window and
// hit-test the drop zones via elementFromPoint — the same approach the editor
// tab reorder uses.
export function useDockDrag(place: (t: ToolId, d: Dock, s: Slot) => void) {
    const [dragTool, setDragTool] = useState<ToolId | null>(null);
    const [hot, setHot] = useState<string | null>(null);
    const st = useRef({ tool: null as ToolId | null, moved: false, x: 0, y: 0, hot: null as string | null });

    const onPointerDown = useCallback(
        (tool: ToolId, e: ReactPointerEvent, onClick?: () => void) => {
            if (e.button !== 0) return;
            e.preventDefault();
            const s = st.current;
            s.tool = tool;
            s.moved = false;
            s.x = e.clientX;
            s.y = e.clientY;
            s.hot = null;

            const move = (ev: PointerEvent) => {
                if (!s.moved && Math.hypot(ev.clientX - s.x, ev.clientY - s.y) < THRESHOLD) return;
                if (!s.moved) {
                    s.moved = true;
                    setDragTool(s.tool);
                }
                const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
                const zone = el?.closest<HTMLElement>("[data-zone]");
                s.hot = zone?.dataset.zone ?? null;
                setHot(s.hot);
            };
            const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                if (!s.moved) onClick?.();
                else if (s.hot && s.tool) {
                    const [d, sl] = s.hot.split(".") as [Dock, Slot];
                    place(s.tool, d, sl);
                }
                s.tool = null;
                s.moved = false;
                s.hot = null;
                setDragTool(null);
                setHot(null);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
        },
        [place]
    );

    return { dragTool, hot, onPointerDown };
}
