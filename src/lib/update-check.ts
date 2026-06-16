import { getVersion } from "@tauri-apps/api/app";

const REPO = "S7y1e/Lunar-IDE";

export type UpdateInfo = { version: string; url: string };

// Compares the latest published GitHub release against the running version.
// Returns the update if newer, or null (including on any network/parse error —
// an update check should never disrupt startup).
export async function checkForUpdate(): Promise<UpdateInfo | null> {
    try {
        const res = await fetch(
            `https://api.github.com/repos/${REPO}/releases/latest`,
            { headers: { Accept: "application/vnd.github+json" } }
        );
        if (!res.ok) return null;
        const data = (await res.json()) as { tag_name?: string; html_url?: string };
        const latest = (data.tag_name ?? "").replace(/^v/, "").trim();
        const current = await getVersion();
        if (latest && isNewer(latest, current)) {
            return {
                version: latest,
                url: data.html_url ?? `https://github.com/${REPO}/releases/latest`,
            };
        }
        return null;
    } catch {
        return null;
    }
}

function isNewer(a: string, b: string): boolean {
    const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
    const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const x = pa[i] ?? 0;
        const y = pb[i] ?? 0;
        if (x !== y) return x > y;
    }
    return false;
}
