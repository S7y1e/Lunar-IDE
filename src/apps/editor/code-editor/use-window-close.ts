import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

// Save dirty files and stop the sync server before the window closes, so the
// Rojo/Argon sidecar isn't orphaned holding its port. Each step is isolated so
// a failure can't trap the window open.
export function useWindowClose(saveAll: () => Promise<void>, stopSync: () => Promise<void>) {
    const saveAllRef = useRef(saveAll);
    saveAllRef.current = saveAll;
    const stopSyncRef = useRef(stopSync);
    stopSyncRef.current = stopSync;

    useEffect(() => {
        const win = getCurrentWindow();
        let unlisten: (() => void) | undefined;
        win.onCloseRequested(async (event) => {
            event.preventDefault();
            try {
                await saveAllRef.current();
            } catch (e) {
                console.error("save on close failed", e);
            }
            try {
                await stopSyncRef.current();
            } catch (e) {
                console.error("sync stop on close failed", e);
            }
            // destroy() bypasses onCloseRequested (close() would re-enter and
            // loop). Fall back to close() so a single failure can't trap it open.
            try {
                await win.destroy();
            } catch (e) {
                console.error("window destroy failed, falling back to close", e);
                await win.close();
            }
        }).then((fn) => {
            unlisten = fn;
        });
        return () => unlisten?.();
    }, []);
}
