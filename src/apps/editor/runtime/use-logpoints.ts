import { useState } from "react";
import { logpointsArm, logpointsDisarm } from "../../../lib/project";

export type Logpoint = {
    id: string;
    file: string; // project-relative, "/"-separated
    line: number;
    expr: string;
    includeStack: boolean;
};

export function useLogpoints() {
    const [points, setPoints] = useState<Logpoint[]>([]);
    const [armed, setArmed] = useState(false);
    const idRef = useState(() => ({ n: 0 }))[0];

    const add = (file: string, line: number, expr: string) => {
        const trimmed = expr.trim();
        if (!trimmed) return;
        // Avoid duplicate (same file+line+expr).
        setPoints((prev) => {
            if (prev.some((p) => p.file === file && p.line === line && p.expr === trimmed)) {
                return prev;
            }
            return [...prev, { id: `lp${++idRef.n}`, file, line, expr: trimmed, includeStack: false }];
        });
    };

    const remove = (id: string) => setPoints((prev) => prev.filter((p) => p.id !== id));

    const toggleStack = (id: string) =>
        setPoints((prev) =>
            prev.map((p) => (p.id === id ? { ...p, includeStack: !p.includeStack } : p)),
        );

    const arm = async () => {
        await logpointsArm(points.map(({ file, line, expr, includeStack }) => ({
            file, line, expr, includeStack,
        })));
        setArmed(true);
    };

    const disarm = async () => {
        await logpointsDisarm();
        setArmed(false);
    };

    return { points, armed, add, remove, toggleStack, arm, disarm };
}
