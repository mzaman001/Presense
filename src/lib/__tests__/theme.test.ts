import { describe, expect, test } from "vitest";
import { DEFAULT_THEME_ID, normalizeThemeId } from "@/lib/theme";

describe("theme migration", () => {
  test("there is one theme now — every input normalizes to warm", () => {
    expect(DEFAULT_THEME_ID).toBe("warm");
    expect(normalizeThemeId(undefined)).toBe("warm");
    expect(normalizeThemeId("")).toBe("warm");
    expect(normalizeThemeId("wahala")).toBe("warm");
    expect(normalizeThemeId("orange")).toBe("warm");
    expect(normalizeThemeId("sunset")).toBe("warm");
  });

  test("previously-valid navy and forest values also normalize to warm", () => {
    expect(normalizeThemeId("navy")).toBe("warm");
    expect(normalizeThemeId("blue")).toBe("warm");
    expect(normalizeThemeId("midnight")).toBe("warm");
    expect(normalizeThemeId("forest")).toBe("warm");
    expect(normalizeThemeId("meadow")).toBe("warm");
  });
});
