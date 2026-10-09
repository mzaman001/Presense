import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applySavedAppearance, savedAppearanceScript } from "@/lib/theme-boot";
import { THEME_COLOR } from "@/lib/theme";

// After sign-out (or on a new device) localStorage has no colour mode, so
// the root boot script paints dark until the app hydrates. The (app) layout
// now applies the account's saved appearance before its content paints.

function setMatchMedia(prefersDark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((q: string) => ({
      matches: q.includes("dark") ? prefersDark : !prefersDark,
    })),
  );
}

describe("applySavedAppearance", () => {
  beforeEach(() => {
    localStorage.clear();
    const html = document.documentElement;
    html.setAttribute("data-mode", "dark");
    html.classList.remove("reduce-motion");
    document.head.innerHTML = '<meta name="theme-color" content="#141118">';
    setMatchMedia(true);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("applies a light-mode account's setting and stores it for next time", () => {
    applySavedAppearance("light", false, THEME_COLOR);
    const html = document.documentElement;
    expect(html.getAttribute("data-mode")).toBe("light");
    expect(localStorage.getItem("presense_color_mode")).toBe("light");
    expect(
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!
        .content,
    ).toBe(THEME_COLOR.light);
  });

  it("resolves system mode with the device preference", () => {
    setMatchMedia(false);
    applySavedAppearance("system", false, THEME_COLOR);
    expect(document.documentElement.getAttribute("data-mode")).toBe("light");
    expect(localStorage.getItem("presense_color_mode")).toBe("system");
  });

  it("applies reduce motion", () => {
    applySavedAppearance("dark", true, THEME_COLOR);
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(
      true,
    );
    expect(localStorage.getItem("presense_reduce_motion")).toBe("true");
  });

  it("works as a standalone inline script", () => {
    const script = savedAppearanceScript("light", false);
    // No imports or closures: it must run with nothing but the page.
    new Function(script)();
    expect(document.documentElement.getAttribute("data-mode")).toBe("light");
  });

  it("only ever embeds a known mode in the script", () => {
    const script = savedAppearanceScript("</script><script>x", false);
    expect(script).not.toContain("</script>");
    expect(script).toContain('"dark"');
  });
});
