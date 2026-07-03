export type ThemeId = "sunset" | "midnight" | "meadow";
export type ColorMode = "dark" | "light" | "system";

export const DEFAULT_THEME_ID: ThemeId = "sunset";
export const DEFAULT_COLOR_MODE: ColorMode = "dark";

const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  orange: "sunset",
  wahala: "sunset",
  blue: "sunset",
  navy: "sunset",
  forest: "meadow",
};

export function normalizeThemeId(value: unknown): ThemeId {
  if (typeof value !== "string") return DEFAULT_THEME_ID;
  const normalized = value.trim().toLowerCase();
  if (normalized === "sunset" || normalized === "midnight" || normalized === "meadow") {
    return normalized;
  }
  return LEGACY_THEME_MAP[normalized] ?? DEFAULT_THEME_ID;
}

export function normalizeColorMode(value: unknown): ColorMode {
  return value === "light" || value === "system" || value === "dark" ? value : DEFAULT_COLOR_MODE;
}

export function getThemeClassNames(themeValue: unknown, modeValue: unknown, prefersLight = false): string[] {
  const theme = normalizeThemeId(themeValue);
  const mode = normalizeColorMode(modeValue);
  const classes: string[] = [];

  if (theme === "midnight") classes.push("theme-midnight");
  if (theme === "meadow") classes.push("theme-meadow");
  if (mode === "light" || (mode === "system" && prefersLight)) classes.push("light");

  return classes;
}

export function applyDocumentTheme(themeValue: unknown, modeValue: unknown, reduceMotion = false) {
  if (typeof document === "undefined") return;
  const prefersLight = typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: light)").matches
    : false;
  const html = document.documentElement;
  html.classList.remove(
    "theme-blue",
    "theme-navy",
    "theme-midnight",
    "theme-forest",
    "theme-meadow",
    "light",
    "reduce-motion",
  );
  html.classList.add(...getThemeClassNames(themeValue, modeValue, prefersLight));
  if (reduceMotion) html.classList.add("reduce-motion");
}
