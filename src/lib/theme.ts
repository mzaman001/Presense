export type ThemeId = "warm" | "navy" | "forest";
export type ColorMode = "dark" | "light" | "system";

export const DEFAULT_THEME_ID: ThemeId = "warm";
export const DEFAULT_COLOR_MODE: ColorMode = "dark";

/**
 * Browser-chrome colour per mode — must equal --bg-base in globals.css so
 * the mobile status bar / address bar melts into the page. The inline
 * boot script in app/layout.tsx duplicates these two literals because it
 * runs before any module loads; keep them in sync.
 */
export const THEME_COLOR: Record<"light" | "dark", string> = {
  light: "#f7f2ec",
  dark: "#141118",
};

/**
 * There is one theme now (design overhaul spec §4/§6 — the warm/navy/
 * forest selector is retired). Every input, including previously-valid
 * theme ids, normalizes to "warm" — the name is kept internally (rather
 * than renaming the type to a single literal) so callers that key a
 * lookup table by ThemeId, like the sidebar's avatar-accent fallback in
 * Navigation.tsx, don't need to change in this pass.
 */
export function normalizeThemeId(_value: unknown): ThemeId {
  return DEFAULT_THEME_ID;
}

export function normalizeColorMode(value: unknown): ColorMode {
  return value === "light" || value === "system" || value === "dark"
    ? value
    : DEFAULT_COLOR_MODE;
}

export function applyDocumentTheme(
  themeValue: unknown,
  modeValue: unknown,
  reduceMotion = false,
  densityValue?: unknown,
) {
  if (typeof document === "undefined") return;
  const prefersLight =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
      : false;

  const theme = normalizeThemeId(themeValue);
  const chosen = normalizeColorMode(modeValue);
  const mode: "light" | "dark" =
    chosen === "system" ? (prefersLight ? "light" : "dark") : chosen;

  const html = document.documentElement;
  const previousMode = html.getAttribute("data-mode");
  // Not on load: the boot script in app/layout.tsx has already set it.
  const modeChanges = previousMode !== null && previousMode !== mode;

  const commit = () => {
    // Every colour on the page changes at once. With the elements' own
    // colour transitions running (body alone has a 300ms one) that is a
    // full-page repaint for every frame of them, so they're switched off
    // for the swap: styles are flushed once with transitions disabled,
    // then re-enabled on the next frame (which starts none).
    if (modeChanges) html.classList.add("theme-switching");

    // Clear legacy classes
    html.classList.remove(
      "theme-blue",
      "theme-navy",
      "theme-midnight",
      "theme-forest",
      "theme-meadow",
      "light",
    );

    // Set modern attributes
    html.setAttribute("data-theme", theme);
    html.setAttribute("data-mode", mode);

    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = THEME_COLOR[mode];

    if (reduceMotion) {
      html.classList.add("reduce-motion");
    } else {
      html.classList.remove("reduce-motion");
    }

    if (densityValue === "comfortable" || densityValue === "compact") {
      html.setAttribute("data-density", densityValue as string);
    } else {
      const isTouch =
        typeof window !== "undefined" &&
        ("ontouchstart" in window || navigator.maxTouchPoints > 0);
      html.setAttribute("data-density", isTouch ? "comfortable" : "compact");
    }

    if (modeChanges) {
      void document.body?.offsetHeight;
      requestAnimationFrame(() => html.classList.remove("theme-switching"));
    }
  };

  // A mode change crossfades through one view transition (the fade is in
  // globals.css). Reduced motion, a hidden tab and browsers without the
  // API get the instant switch.
  const motionOk =
    !reduceMotion &&
    !html.classList.contains("reduce-motion") &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (
    modeChanges &&
    motionOk &&
    document.visibilityState === "visible" &&
    typeof document.startViewTransition === "function"
  ) {
    html.dataset.modeTransition = "";
    const transition = document.startViewTransition(commit);
    void transition.finished.finally(() => {
      delete html.dataset.modeTransition;
    });
    return;
  }
  commit();
}
