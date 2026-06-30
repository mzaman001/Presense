import { test, expect } from '@playwright/test';

test('login page is visible', async ({ page }) => {
  // Go to the login page
  await page.goto('/login');

  // Verify the URL contains '/login'
  await expect(page).toHaveURL(/.*login/);
});
