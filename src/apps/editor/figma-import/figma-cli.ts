// Live test: fetch a Figma frame and print the mapped Roblox tree.
//   FIGMA_TOKEN=figd_... bun src/apps/editor/figma-import/figma-cli.ts <figma-url>
// or: bun src/apps/editor/figma-import/figma-cli.ts <fileKey> <nodeId> <token>

import { fetchFrame, parseFigmaUrl } from "./figma-client";
import { mapFigma } from "./map-figma";
import type { UiNode } from "./figma-types";

// Dev-only CLI (bun). Minimal ambient so tsc stays clean without @types/node.
declare const process: {
    argv: string[];
    env: Record<string, string | undefined>;
    exit(code: number): never;
};

function show(n: UiNode, depth = 0): void {
    const pad = "  ".repeat(depth);
    const { x, y } = n.pos;
    const { w, h } = n.size;
    const p = n.props;
    const extra =
        p.text !== undefined
            ? ` text=${JSON.stringify(p.text)}`
            : p.backgroundColor
              ? ` bg=rgb(${p.backgroundColor.join(",")})`
              : "";
    console.log(`${pad}${n.className}  "${n.name}"  @(${x},${y}) ${w}x${h}${extra}`);
    n.children.forEach((c) => show(c, depth + 1));
}

const args = process.argv.slice(2);
const env = process.env.FIGMA_TOKEN;

const run = async () => {
    let fileKey: string, nodeId: string, token: string;
    if (args.length >= 1 && args[0].includes("figma.com")) {
        ({ fileKey, nodeId } = parseFigmaUrl(args[0]));
        token = args[1] || env || "";
    } else {
        [fileKey, nodeId, token] = [args[0], args[1], args[2] || env || ""];
    }
    if (!fileKey || !nodeId || !token) {
        console.error("usage: figma-cli <url> [token]   (token via $FIGMA_TOKEN)");
        process.exit(1);
    }
    const doc = await fetchFrame(fileKey, nodeId, token);
    const tree = mapFigma(doc);
    if (!tree) {
        console.error("root node is excluded");
        process.exit(1);
    }
    show(tree);
};

run().catch((e) => {
    console.error(String(e));
    process.exit(1);
});
