import { runProjectTest } from "../../../lib/project";
import { Toasts } from "../notifications/use-toasts";

export function useTest(toasts: Toasts) {
    const test = async () => {
        const id = toasts.push("info", "Running tests…");
        try {
            const result = await runProjectTest();
            const detail = result.output.trim() || undefined;
            if (result.code === 0) {
                toasts.set(id, "success", "Tests passed", detail, 6000);
            } else {
                toasts.set(id, "error", "Tests failed", detail);
            }
        } catch (error) {
            toasts.set(id, "error", "Test run failed", String(error));
        }
    };

    return { test };
}
