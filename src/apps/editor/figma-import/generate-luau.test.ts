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
ok(code.includes('Instance.new("ScreenGui")'), "has ScreenGui");
ok(code.includes('Instance.new("ImageButton")'), "Button -> ImageButton");
ok(code.includes('.Text = "text test"'), "text set");
ok(code.includes("Color3.fromRGB(127, 181, 80)"), "green bg");
ok(code.includes('game:GetService("StarterGui")'), "parents to StarterGui");

const scaled = generateLuau(tree, { root: "ScreenGui", mode: "Scaled" });
ok(scaled.includes("UDim2.fromScale(1, 1)"), "scaled root fills");
ok(scaled.includes("UDim2.fromScale(0.6633, 0.08)"), "scaled child frac (Frame2 199/300, 16/200)");
ok(!scaled.includes("fromOffset"), "scaled uses no offset");

console.log(fail === 0 ? "\nALL OK" : `\n${fail} FAILED`);
