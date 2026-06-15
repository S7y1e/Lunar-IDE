import { type DataModelNode } from "../../../lib/project";
import { scriptPath } from "../data-model/instance-path";

// At runtime Roblox clones the Starter* containers into each player, so a
// play-test path points at the runtime copy, not the source. Map it back to the
// container the sourcemap actually owns before traversing.
//   Players.<name>.PlayerScripts.* -> StarterPlayer.StarterPlayerScripts.*
//   Players.<name>.PlayerGui.*     -> StarterGui.*
//   Players.<name>.Backpack.*      -> StarterPack.*
function mapRuntimeContainers(segments: string[]): string[] {
    if (segments[0] === "Players" && segments.length >= 3) {
        const rest = segments.slice(3);
        switch (segments[2]) {
            case "PlayerScripts":
                return ["StarterPlayer", "StarterPlayerScripts", ...rest];
            case "PlayerGui":
                return ["StarterGui", ...rest];
            case "Backpack":
                return ["StarterPack", ...rest];
        }
    }
    return segments;
}

// Maps a Studio instance path (e.g. "ServerScriptService.main", optionally
// "game."-prefixed) to the relative source file the sourcemap owns, or null.
export function makeResolver(
    tree: DataModelNode | null
): (dotPath: string) => string | null {
    return (dotPath: string) => {
        if (!tree) return null;
        let segments = dotPath.split(".");
        if (segments[0] === "game") segments = segments.slice(1);
        segments = mapRuntimeContainers(segments);
        if (segments.length === 0) return null;

        let node: DataModelNode = tree;
        for (const segment of segments) {
            const child = node.children?.find((c) => c.name === segment);
            if (!child) return null;
            node = child;
        }
        return scriptPath(node);
    };
}
