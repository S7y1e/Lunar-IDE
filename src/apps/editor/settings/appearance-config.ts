import { Setting } from "./setting";
import { DEFAULT_THEME, THEMES, THEME_LABELS } from "../../../lib/theme";

export const APPEARANCE_SETTINGS: Setting[] = [
    {
        key: "lunar.theme",
        tool: "Editor",
        category: "Appearance",
        label: "Theme",
        type: "string",
        default: DEFAULT_THEME,
        enum: [...THEMES],
        enumLabels: THEME_LABELS,
        description: "Color theme for the whole IDE (editor, panels and terminal).",
    },
];
