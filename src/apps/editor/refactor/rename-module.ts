import { join } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, rename } from "@tauri-apps/plugin-fs";
import { getProjectDependencies } from "../../../lib/project";
import { toRelative } from "../data-model/instance-path";

// Order matters: longest suffix first so "X.server.luau" strips to "X".
const SUFFIXES = [
    ".server.luau",
    ".client.luau",
    ".server.lua",
    ".client.lua",
    ".luau",
    ".lua",
];

// Only lines that look like an instance reference get rewritten.
const TRIGGER = /require|WaitForChild|FindFirstChild/;

export type RenameEdit = {
    file: string;
    line: number;
    before: string;
    after: string;
};

export type RenamePlan = {
    oldRel: string;
    newRel: string;
    oldName: string;
    newName: string;
    edits: RenameEdit[];
};

function splitModule(rel: string): { dir: string; name: string; suffix: string } | null {
    const slash = rel.lastIndexOf("/");
    const dir = slash >= 0 ? rel.slice(0, slash + 1) : "";
    const base = rel.slice(slash + 1);
    for (const suffix of SUFFIXES) {
        if (base.endsWith(suffix)) {
            return { dir, name: base.slice(0, -suffix.length), suffix };
        }
    }
    return null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Build (don't apply) the rename plan: the new path + every line in a dependent
// that references the old instance name. Caller previews, then applies.
export async function buildRenamePlan(
    root: string,
    activeAbs: string,
    newName: string
): Promise<RenamePlan | null> {
    const oldRel = toRelative(root, activeAbs);
    const mod = splitModule(oldRel);
    if (!mod || !newName.trim()) return null;

    const newRel = `${mod.dir}${newName.trim()}${mod.suffix}`;
    const graph = await getProjectDependencies();
    const dependents = (graph?.edges ?? [])
        .filter((e) => e.to === oldRel)
        .map((e) => e.from);

    const word = new RegExp(`\\b${escape(mod.name)}\\b`);
    const edits: RenameEdit[] = [];
    for (const dep of dependents) {
        let text: string;
        try {
            text = await readTextFile(await join(root, ...dep.split("/")));
        } catch {
            continue;
        }
        text.split(/\r?\n/).forEach((line, i) => {
            if (TRIGGER.test(line) && word.test(line)) {
                edits.push({
                    file: dep,
                    line: i + 1,
                    before: line,
                    after: line.replace(new RegExp(`\\b${escape(mod.name)}\\b`, "g"), newName.trim()),
                });
            }
        });
    }
    return { oldRel, newRel, oldName: mod.name, newName: newName.trim(), edits };
}

// Apply the plan: rewrite each dependent line (only if it still matches the
// previewed text), then rename the file on disk. Returns the new absolute path.
export async function applyRenamePlan(
    root: string,
    plan: RenamePlan
): Promise<string> {
    const byFile = new Map<string, RenameEdit[]>();
    for (const edit of plan.edits) {
        const list = byFile.get(edit.file) ?? [];
        list.push(edit);
        byFile.set(edit.file, list);
    }

    for (const [file, fileEdits] of byFile) {
        const abs = await join(root, ...file.split("/"));
        const text = await readTextFile(abs);
        const lines = text.split(/\r?\n/);
        for (const edit of fileEdits) {
            if (lines[edit.line - 1] === edit.before) {
                lines[edit.line - 1] = edit.after;
            }
        }
        await writeTextFile(abs, lines.join("\n"));
    }

    const oldAbs = await join(root, ...plan.oldRel.split("/"));
    const newAbs = await join(root, ...plan.newRel.split("/"));
    await rename(oldAbs, newAbs);
    return newAbs;
}
