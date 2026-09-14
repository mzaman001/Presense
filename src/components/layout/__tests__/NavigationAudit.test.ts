/* AUDIT-01 (Aug 19, 2026): the sidebar avatar's accent-color fallback used to
   read `getComputedStyle(document.documentElement)` during SSR and errored in
   production with `ReferenceError: getComputedStyle is not defined`. The fix
   resolves the fallback from a lookup table plus a client-only `data-mode`
   attribute read, never touching computed styles. This file guards that
   contract, updated for the single-theme system (design overhaul Phase 2):
   the lookup now keys on light/dark mode, not the retired warm/navy/forest
   theme id, since there is only one theme's accent to fall back to now. */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const AVATAR_ACCENT_BY_MODE: Record<string, string> = {
  dark: "#d97757",
  light: "#9c4a2e",
};

describe("AUDIT-01 — avatar accent fallback", () => {
  it("returns the current theme's accent for both color modes", () => {
    expect(AVATAR_ACCENT_BY_MODE["dark"]).toBe("#d97757");
    expect(AVATAR_ACCENT_BY_MODE["light"]).toBe("#9c4a2e");
  });

  it("the fix never reads computed styles (the prod SSR error source)", () => {
    expect(() => AVATAR_ACCENT_BY_MODE["dark"]).not.toThrow();
    expect(() => AVATAR_ACCENT_BY_MODE["unknown-mode"]).not.toThrow();
    const src = fs.readFileSync(
      path.resolve(__dirname, "../Navigation.tsx"),
      "utf8",
    );
    expect(src.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain(
      "getComputedStyle",
    );
  });

  it("no longer keys the fallback on the retired theme id", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../Navigation.tsx"),
      "utf8",
    );
    expect(src).not.toContain("data-theme");
    expect(src).not.toContain("AVATAR_ACCENT_BY_THEME");
  });
});
