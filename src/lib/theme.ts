import { readSettings, subscribeSettings, SettingsValues } from "./settings";

export type ThemeName =
    | "luau"
    | "luau-light"
    | "nord"
    | "dracula"
    | "tokyo-night"
    | "one-dark"
    | "catppuccin-mocha"
    | "gruvbox-dark";

export const THEMES: ThemeName[] = [
    "luau",
    "luau-light",
    "nord",
    "dracula",
    "tokyo-night",
    "one-dark",
    "catppuccin-mocha",
    "gruvbox-dark",
];
export const DEFAULT_THEME: ThemeName = "nord";

export const THEME_SETTING_KEY = "lunar.theme";

/** Display names for the theme picker. */
export const THEME_LABELS: Record<ThemeName, string> = {
    luau: "Luau",
    "luau-light": "Luau Light",
    nord: "Nord",
    dracula: "Dracula",
    "tokyo-night": "Tokyo Night",
    "one-dark": "One Dark",
    "catppuccin-mocha": "Catppuccin Mocha",
    "gruvbox-dark": "Gruvbox Dark",
};

/** Monaco editor theme id registered for each app theme. */
export const MONACO_THEME: Record<ThemeName, string> = Object.fromEntries(
    THEMES.map((name) => [name, `lunar-${name}`]),
) as Record<ThemeName, string>;

function normalize(value: unknown): ThemeName {
    return THEMES.includes(value as ThemeName) ? (value as ThemeName) : DEFAULT_THEME;
}

let current: ThemeName = DEFAULT_THEME;
const listeners = new Set<(theme: ThemeName) => void>();

/** Read the active theme from the persisted settings (sync best-effort). */
export function getTheme(): ThemeName {
    return current;
}

/** Apply a theme by flipping the `data-theme` attribute and notifying listeners. */
export function applyTheme(theme: ThemeName): void {
    current = theme;
    document.documentElement.dataset.theme = theme;
    for (const listener of listeners) listener(theme);
}

/** Subscribe to theme changes. Returns an unsubscribe function. */
export function subscribeTheme(listener: (theme: ThemeName) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Read the current theme tokens from CSS custom properties so JS-rendered
 * surfaces (Monaco, xterm) can match the active palette.
 */
export function readToken(name: string): string {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(`--${name}`)
        .trim();
}

/** Load the saved theme and keep it in sync with settings changes. */
export async function initTheme(): Promise<void> {
    const apply = (values: SettingsValues) =>
        applyTheme(normalize(values[THEME_SETTING_KEY]));

    apply(await readSettings());
    subscribeSettings(apply);
}
