
import { test, expect } from '@playwright/test';

test('home loads and shows Start AR', async ({ page }) => {
  await page.goto('/art/sample');
  await expect(page.getByRole('button', { name: /start ar/i })).toBeVisible();
});
