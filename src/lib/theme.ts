export type ThemeId = "warm" | "navy" | "forest";
export type ColorMode = "dark" | "light" | "system";

export const DEFAULT_THEME_ID: ThemeId = "warm";
export const DEFAULT_COLOR_MODE: ColorMode = "dark";

const LEGACY_THEME_MAP: Record<string, ThemeId> = {
  orange: "warm",
  wahala: "warm",
  sunset: "warm",
  blue: "navy",
  midnight: "navy",
  navy: "navy",
  forest: "forest",
  meadow: "forest",
};

export function normalizeThemeId(value: unknown): ThemeId {
  if (typeof value !== "string") return DEFAULT_THEME_ID;
  const normalized = value.trim().toLowerCase();
  if (normalized === "warm" || normalized === "navy" || normalized === "forest") {
    return normalized;
  }
  return LEGACY_THEME_MAP[normalized] ?? DEFAULT_THEME_ID;
}

export function normalizeColorMode(value: unknown): ColorMode {
  return value === "light" || value === "system" || value === "dark" ? value : DEFAULT_COLOR_MODE;
}

export function applyDocumentTheme(themeValue: unknown, modeValue: unknown, reduceMotion = false, densityValue?: unknown) {
  if (typeof document === "undefined") return;
  const prefersLight = typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: light)").matches
    : false;
  
  const theme = normalizeThemeId(themeValue);
  let mode = normalizeColorMode(modeValue);
  if (mode === "system") {
    mode = prefersLight ? "light" : "dark";
  }

  const html = document.documentElement;
  
  // Clear legacy classes
  html.classList.remove(
    "theme-blue",
    "theme-navy",
    "theme-midnight",
    "theme-forest",
    "theme-meadow",
    "light"
  );
  
  // Set modern attributes
  html.setAttribute("data-theme", theme);
  html.setAttribute("data-mode", mode);
  
  if (reduceMotion) {
    html.classList.add("reduce-motion");
  } else {
    html.classList.remove("reduce-motion");
  }

  if (densityValue === "comfortable" || densityValue === "compact") {
    html.setAttribute("data-density", densityValue as string);
  } else {
    const isTouch = typeof window !== "undefined" && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
    html.setAttribute("data-density", isTouch ? "comfortable" : "compact");
  }
}
