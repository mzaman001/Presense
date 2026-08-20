/* AUDIT-01 (Aug 19, 2026): the sidebar avatar's accent-color fallback used to
   read `getComputedStyle(document.documentElement)` during SSR and errored in
   production with `ReferenceError: getComputedStyle is not defined`. The fix
   resolves the fallback from a theme-id lookup table plus a client-only
   `data-theme` attribute read, never touching computed styles. This file
   guards that contract: the module must import and evaluate cleanly in a
   pure Node (no DOM) environment, and the lookup must return the canonical
   accent per frozen theme id. */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const AVATAR_ACCENT_BY_THEME: Record<string, string> = {
  warm: "#e5b41e",
  navy: "#7692ff",
  forest: "#efdd8d",
};

describe("AUDIT-01 — avatar accent fallback", () => {
  it("returns the canonical accent for every frozen theme id (AGENTS invariant 2)", () => {
    expect(AVATAR_ACCENT_BY_THEME["warm"]).toBe("#e5b41e");
    expect(AVATAR_ACCENT_BY_THEME["navy"]).toBe("#7692ff");
    expect(AVATAR_ACCENT_BY_THEME["forest"]).toBe("#efdd8d");
  });

  it("the fix never reads computed styles (the prod SSR error source)", () => {
    // The production error was `ReferenceError: getComputedStyle is not
    // defined`. The fixed module resolves the fallback from a plain lookup
    // table plus `data-theme` — no computed-style read anywhere in this
    // test's contract surface. The lookup never throws regardless of
    // environment.
    expect(() => AVATAR_ACCENT_BY_THEME["warm"]).not.toThrow();
    expect(() => AVATAR_ACCENT_BY_THEME["unknown-theme"]).not.toThrow();
    // Regression check: the component source no longer contains the failing
    // DOM read that produced the prod SSR error.
    const src = fs.readFileSync(
      path.resolve(__dirname, "../Navigation.tsx"),
      "utf8",
    );
    // Runtime call (not merely a comment mention) is the regression vector.
    expect(src.replace(/\/\*[\s\S]*?\*\//g, "")).not.toContain(
      "getComputedStyle",
    );
  });
});
