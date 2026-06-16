import { callersOf, type CallerSite } from "../../../lib/project";

export type { CallerSite };
export type CallTarget = { name: string };

// Who calls a function (by name), across the whole project — the Rust call graph
// resolves cross-module calls the LSP can't (e.g. PlayerManager.AddPlayer used in
// another file via require).
export function findCallers(name: string): Promise<CallerSite[]> {
    return callersOf(name);
}
