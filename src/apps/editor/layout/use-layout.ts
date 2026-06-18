import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readSettings, writeSettings } from "../../../lib/settings";
import {
    ALL_TOOLS,
    DEFAULT_LAYOUT,
    SLOTS,
    regionId,
    withDefaults,
    type Dock,
    type RegionId,
    type Slot,
    type ToolId,
    type LayoutState,
} from "./layout-types";

const SETTINGS_KEY = "lunar.layout";

export function useLayout() {
    const [state, setState] = useState<LayoutState>(DEFAULT_LAYOUT);
    const loaded = useRef(false);

    useEffect(() => {
        readSettings()
            .then((v) => {
                const saved = v[SETTINGS_KEY] as Partial<LayoutState> | undefined;
                if (saved?.placement) setState(withDefaults(saved));
            })
            .finally(() => (loaded.current = true));
    }, []);

    // Persist after the initial load, debounced so a burst of moves writes once.
    useEffect(() => {
        if (!loaded.current) return;
        const t = setTimeout(() => {
            readSettings().then((v) => writeSettings({ ...v, [SETTINGS_KEY]: state }));
        }, 300);
        return () => clearTimeout(t);
    }, [state]);

    const region = useCallback(
        (t: ToolId): RegionId => regionId(state.placement[t].dock, state.placement[t].slot),
        [state.placement]
    );

    const ops = useMemo(() => {
        const setActive = (r: RegionId, t: ToolId) =>
            setState((s) => ({ ...s, active: { ...s.active, [r]: t } }));

        const collapse = (r: RegionId) =>
            setState((s) => {
                const active = { ...s.active };
                delete active[r];
                return { ...s, active };
            });

        const toggle = (t: ToolId) =>
            setState((s) => {
                const r = regionId(s.placement[t].dock, s.placement[t].slot);
                const active = { ...s.active };
                if (active[r] === t) delete active[r];
                else active[r] = t;
                return { ...s, active };
            });

        const open = (t: ToolId) =>
            setState((s) => {
                const r = regionId(s.placement[t].dock, s.placement[t].slot);
                return { ...s, active: { ...s.active, [r]: t } };
            });

        // Move a tool to (dock, slot): clear it from its old region if it was the
        // active one there, then make it active in the target region.
        const place = (t: ToolId, dock: Dock, slot: Slot) =>
            setState((s) => {
                const oldR = regionId(s.placement[t].dock, s.placement[t].slot);
                const newR = regionId(dock, slot);
                const active = { ...s.active };
                if (active[oldR] === t) delete active[oldR];
                active[newR] = t;
                return { ...s, placement: { ...s.placement, [t]: { dock, slot } }, active };
            });

        return { setActive, collapse, toggle, open, place };
    }, []);

    const toolsInDock = useCallback(
        (d: Dock) => ALL_TOOLS.filter((t) => state.placement[t].dock === d),
        [state.placement]
    );

    const activeIn = useCallback((r: RegionId) => state.active[r], [state.active]);

    // Slots of a dock that have a visible tool actually placed there (guards
    // against a stale active entry pointing at a moved-away tool).
    const openSlots = useCallback(
        (d: Dock): Slot[] =>
            SLOTS.filter((slot) => {
                const t = state.active[regionId(d, slot)];
                return !!t && state.placement[t].dock === d && state.placement[t].slot === slot;
            }),
        [state]
    );

    const isOpen = useCallback((t: ToolId) => activeIn(region(t)) === t, [activeIn, region]);

    return { ...ops, region, toolsInDock, activeIn, openSlots, isOpen };
}
