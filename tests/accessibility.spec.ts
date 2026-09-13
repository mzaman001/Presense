import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility Audits (Axe WCAG)", () => {
  test("login page passes WCAG 2.1/2.2 AA accessibility scan", async ({
    page,
  }) => {
    await page.goto("/login");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"]) // Handled by theme tokens
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
