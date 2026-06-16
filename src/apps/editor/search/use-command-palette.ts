import { useEffect, useState } from "react";

export function useCommandPalette() {
    const [isOpen, setIsOpen] = useState(false);
    const [initialQuery, setInitialQuery] = useState("");

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
                e.preventDefault();
                setInitialQuery(e.shiftKey ? ">" : "");
                setIsOpen(true);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return {
        isOpen,
        initialQuery,
        open: () => {
            setInitialQuery("");
            setIsOpen(true);
        },
        openCommands: () => {
            setInitialQuery(">");
            setIsOpen(true);
        },
        close: () => setIsOpen(false),
    };
}
