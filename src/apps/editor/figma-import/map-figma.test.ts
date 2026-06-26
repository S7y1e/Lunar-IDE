// Ad-hoc runner: `bun src/apps/editor/figma-import/map-figma.test.ts`.
// Prints the mapped tree and asserts the known cases of the `integration` frame.

import type { FigmaNode, UiNode } from "./figma-types";
import { mapFigma } from "./map-figma";
import fixture from "./__fixtures__/integration.json";

const tree = mapFigma(fixture as FigmaNode);
if (!tree) throw new Error("root excluded");

function show(n: UiNode, depth = 0): void {
    const pad = "  ".repeat(depth);
    const { x, y } = n.pos;
    const { w, h } = n.size;
    const extra =
        n.props.text !== undefined
            ? ` text=${JSON.stringify(n.props.text)}`
            : n.props.backgroundColor
              ? ` bg=rgb(${n.props.backgroundColor.join(",")})`
              : "";
    console.log(`${pad}${n.className}  "${n.name}"  @(${x},${y}) ${w}x${h}${extra}`);
    n.children.forEach((c) => show(c, depth + 1));
}

show(tree);

let fail = 0;
const ok = (cond: boolean, msg: string) => {
    if (!cond) {
        fail++;
        console.error("FAIL:", msg);
    }
};

ok(tree.className === "Frame", "root -> Frame");
ok(tree.pos.x === 0 && tree.pos.y === 0, "root pos 0,0");
ok(JSON.stringify(tree.props.backgroundColor) === "[119,119,119]", "root bg gray");
ok(tree.props.clipsDescendants === true, "root clips");

const frame2 = tree.children[0];
ok(frame2.className === "Frame", "Frame 2 -> Frame");
ok(frame2.pos.x === 199 && frame2.pos.y === 16, "Frame 2 relative pos");

const text = frame2.children[0];
ok(text.className === "TextLabel", "text -> TextLabel");
ok(text.props.text === "text test", "text content");
ok(text.pos.x === 8 && text.pos.y === 9, "text relative to Frame 2");
ok(text.props.font === "Gotham", "Inter -> Gotham fallback");

const button = tree.children[1];
ok(button.className === "Frame", "plain rectangle 'Button' -> Frame (no auto-button)");

console.log(fail === 0 ? "\nALL OK" : `\n${fail} FAILED`);
