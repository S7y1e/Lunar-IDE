import { useEffect, useRef, useState } from "react";
import { type Scope } from "./use-palette";

const DOUBLE_TAP_MS = 400;

export function useCommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [initialScope, setInitialScope] = useState<Scope>("all");
    const lastShift = useRef(0);

    const openWith = (scope: Scope) => {
        setInitialScope(scope);
        setIsOpen(true);
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Double-Shift → Search Everywhere (IntelliJ). Ignore key-repeat and
            // reset the timer whenever any non-Shift key is pressed.
            if (e.key === "Shift") {
                if (e.repeat) return;
                const now = Date.now();
                if (now - lastShift.current < DOUBLE_TAP_MS) {
                    lastShift.current = 0;
                    openWith("all");
                } else {
                    lastShift.current = now;
                }
                return;
            }
            lastShift.current = 0;

            if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
                e.preventDefault();
                openWith(e.shiftKey ? "actions" : "files");
            } else if (e.ctrlKey && (e.key === "t" || e.key === "T")) {
                e.preventDefault();
                openWith("symbols");
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return {
        isOpen,
        initialScope,
        open: () => openWith("all"),
        openCommands: () => openWith("actions"),
        openSymbols: () => openWith("symbols"),
        close: () => setIsOpen(false),
    };
}
