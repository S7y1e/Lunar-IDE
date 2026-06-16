import { useRef, useState } from "react";

export type ToastKind = "info" | "success" | "error";
export type ToastAction = { label: string; run: () => void };
export type Toast = {
    id: number;
    kind: ToastKind;
    message: string;
    detail?: string;
    action?: ToastAction;
};

export function useToasts() {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const idRef = useRef(0);

    const dismiss = (id: number) =>
        setToasts((list) => list.filter((t) => t.id !== id));

    const set = (
        id: number,
        kind: ToastKind,
        message: string,
        detail?: string,
        autoMs?: number,
        action?: ToastAction
    ) => {
        setToasts((list) => {
            const next = { id, kind, message, detail, action };
            return list.some((t) => t.id === id)
                ? list.map((t) => (t.id === id ? next : t))
                : [...list, next];
        });
        if (autoMs) setTimeout(() => dismiss(id), autoMs);
    };

    // Returns the id so callers can update an in-progress toast in place.
    const push = (
        kind: ToastKind,
        message: string,
        detail?: string,
        autoMs?: number,
        action?: ToastAction
    ) => {
        const id = ++idRef.current;
        set(id, kind, message, detail, autoMs, action);
        return id;
    };

    return { toasts, push, set, dismiss };
}

export type Toasts = ReturnType<typeof useToasts>;
