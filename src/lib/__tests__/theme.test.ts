import { describe, expect, test } from "vitest";
import { DEFAULT_THEME_ID, normalizeThemeId } from "@/lib/theme";

describe("theme migration", () => {
  test("defaults unknown and empty theme values to warm", () => {
    expect(DEFAULT_THEME_ID).toBe("warm");
    expect(normalizeThemeId(undefined)).toBe("warm");
    expect(normalizeThemeId("")).toBe("warm");
    expect(normalizeThemeId("wahala")).toBe("warm");
  });

  test("maps legacy themes to their new canonical names", () => {
    expect(normalizeThemeId("orange")).toBe("warm");
    expect(normalizeThemeId("sunset")).toBe("warm");
    expect(normalizeThemeId("blue")).toBe("navy");
    expect(normalizeThemeId("midnight")).toBe("navy");
    expect(normalizeThemeId("meadow")).toBe("forest");
  });
});
