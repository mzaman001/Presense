import { describe, expect, test } from "vitest";
import { DEFAULT_THEME_ID, getThemeClassNames, normalizeThemeId } from "@/lib/theme";

describe("theme migration", () => {
  test("defaults unknown and empty theme values to sunset", () => {
    expect(DEFAULT_THEME_ID).toBe("sunset");
    expect(normalizeThemeId(undefined)).toBe("sunset");
    expect(normalizeThemeId("")).toBe("sunset");
    expect(normalizeThemeId("wahala")).toBe("sunset");
  });

  test("maps legacy warm themes to sunset and blue fallback to sunset", () => {
    expect(normalizeThemeId("orange")).toBe("sunset");
    expect(normalizeThemeId("blue")).toBe("sunset");
    expect(normalizeThemeId("navy")).toBe("sunset");
    expect(normalizeThemeId("forest")).toBe("meadow");
  });

  test("returns deterministic document classes", () => {
    expect(getThemeClassNames("sunset", "dark")).toEqual([]);
    expect(getThemeClassNames("midnight", "dark")).toEqual(["theme-midnight"]);
    expect(getThemeClassNames("meadow", "light")).toEqual(["theme-meadow", "light"]);
  });
});
