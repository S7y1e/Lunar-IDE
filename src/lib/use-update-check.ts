import { useEffect } from "react";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import { readSettings } from "./settings";
import { checkForUpdate } from "./update-check";
import { useToasts } from "../apps/editor/notifications/use-toasts";

// On startup, offer to download a newer Lunar release (unless disabled).
export function useUpdateCheck(toasts: ReturnType<typeof useToasts>) {
    useEffect(() => {
        readSettings().then((values) => {
            if (values["lunar.checkForUpdates"] === false) return;
            checkForUpdate().then((info) => {
                if (!info) return;
                toasts.push(
                    "info",
                    `Lunar v${info.version} is available`,
                    "A newer version was published on GitHub.",
                    undefined,
                    {
                        label: "Download",
                        run: () => openExternal(info.url).catch(() => {}),
                    },
                );
            });
        });
    }, []);
}
