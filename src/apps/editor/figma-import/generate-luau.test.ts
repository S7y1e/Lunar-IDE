// bun src/apps/editor/figma-import/generate-luau.test.ts
import type { FigmaNode } from "./figma-types";
import { mapFigma } from "./map-figma";
import { generateLuau } from "./generate-luau";
import fixture from "./__fixtures__/integration.json";

const tree = mapFigma(fixture as FigmaNode);
if (!tree) throw new Error("root excluded");

const code = generateLuau(tree, { root: "ScreenGui" });
console.log(code);

let fail = 0;
const ok = (c: boolean, m: string) => c || (fail++, console.error("FAIL:", m));

ok(code.startsWith("do\n") && code.endsWith("\nend"), "wrapped in do/end");
ok(code.includes("local function build"), "uses data-table builder (no per-node locals)");
ok(code.includes('Instance.new("ScreenGui")'), "has ScreenGui");
ok(code.includes('{"Frame", {Name = "Button"'), "plain rectangle 'Button' -> Frame");
ok(code.includes('Text = "text test"'), "text set");
ok(code.includes("Color3.fromRGB(127, 181, 80)"), "green bg");
ok(code.includes('game:GetService("StarterGui")'), "parents to StarterGui");

const scaled = generateLuau(tree, { root: "ScreenGui", mode: "Scaled" });
ok(scaled.includes('Instance.new("UIScale")'), "scaled adds a root UIScale");
ok(scaled.includes("UDim2.fromOffset(300, 200)"), "scaled keeps exact design px");
ok(scaled.includes("AnchorPoint = Vector2.new(0.5, 0.5)"), "scaled centers root");

console.log(fail === 0 ? "\nALL OK" : `\n${fail} FAILED`);
