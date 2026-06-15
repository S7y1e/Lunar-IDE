import { type DataModelNode } from "../../../lib/project";
import { scriptPath } from "../data-model/instance-path";

// Maps a Studio instance path (e.g. "ServerScriptService.main", optionally
// "game."-prefixed) to the relative source file the sourcemap owns, or null.
export function makeResolver(
    tree: DataModelNode | null
): (dotPath: string) => string | null {
    return (dotPath: string) => {
        if (!tree) return null;
        let segments = dotPath.split(".");
        if (segments[0] === "game") segments = segments.slice(1);
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
