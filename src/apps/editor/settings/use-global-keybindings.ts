import { useEffect, useRef } from "react";
import { readSettings, subscribeSettings, type SettingsValues } from "../../../lib/settings";
import { BINDABLE, keybindKey, chordFromEvent } from "./keybinds";
import { type Command } from "../search/commands";

// Match a keyboard chord against the configured/default binding and run the
// matching command. Refs keep the listener stable across renders.
export function useGlobalKeybindings(commands: Command[]) {
    const settingsRef = useRef<SettingsValues>({});
    useEffect(() => {
        readSettings().then((v) => (settingsRef.current = v));
        return subscribeSettings((v) => (settingsRef.current = v));
    }, []);

    const commandsRef = useRef(commands);
    commandsRef.current = commands;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const chord = chordFromEvent(e);
            if (!chord) return;
            for (const bindable of BINDABLE) {
                const bound =
                    (settingsRef.current[keybindKey(bindable.id)] as string) ||
                    bindable.defaultKey;
                if (bound && bound === chord) {
                    const command = commandsRef.current.find((c) => c.id === bindable.id);
                    if (command && command.enabled !== false) {
                        e.preventDefault();
                        command.run();
                    }
                    return;
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
}
