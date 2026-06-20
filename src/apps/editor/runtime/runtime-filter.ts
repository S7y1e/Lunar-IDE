// Known engine/Studio noise that drowns out the game's own output — asset load
// failures and the like. Hidden by default; the user can toggle them back on.
const NOISE: RegExp[] = [
    /rbxassetid:\/\//i,
    /\bassetid\b/i,
    /failed to load.*\basset/i,
    /\basset\b.*(failed|could not|not approved|not found|moderat)/i,
    // Studio asset-permission spam during play-tests.
    /access permission to use asset/i,
    /click to share access/i,
];

export function isEngineNoise(text: string): boolean {
    return NOISE.some((re) => re.test(text));
}
