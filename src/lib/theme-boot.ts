import { normalizeColorMode, THEME_COLOR, type ColorMode } from "@/lib/theme";

/**
 * Applies the account's saved colour mode and reduce-motion setting to the
 * page and remembers them on this device.
 *
 * The root boot script (app/layout.tsx) reads these from localStorage, which
 * is empty on a new device and after sign-out, so a light-mode user saw dark
 * until the app hydrated. The (app) layout runs this inline, right after the
 * body opens, with the settings it already loaded on the server.
 *
 * Stringified into that script: it must not use imports or anything outside
 * its own body.
 */
export function applySavedAppearance(
  mode: ColorMode,
  reduceMotion: boolean,
  themeColor: Record<"light" | "dark", string>,
) {
  try {
    const html = document.documentElement;
    const resolved =
      mode === "light" ||
      (mode === "system" &&
        !window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "light"
        : "dark";
    html.setAttribute("data-mode", resolved);
    html.classList.toggle("reduce-motion", reduceMotion);
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (meta) meta.content = themeColor[resolved];
    localStorage.setItem("presense_color_mode", mode);
    localStorage.setItem("presense_reduce_motion", String(reduceMotion));
  } catch {
    // Storage or matchMedia unavailable: the app applies it after hydration.
  }
}

export function savedAppearanceScript(
  mode: unknown,
  reduceMotion: boolean,
): string {
  // Only a normalised mode reaches the script, never raw text from the row.
  const args = JSON.stringify([
    normalizeColorMode(mode),
    reduceMotion,
    THEME_COLOR,
  ]);
  return `(${applySavedAppearance.toString()}).apply(null, ${args});`;
}
