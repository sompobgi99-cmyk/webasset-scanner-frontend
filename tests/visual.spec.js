const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');

test('login screen has stable visual baseline and no serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#loginScreen')).toBeVisible();
  await page.locator('#loginUsername').focus();
  await expect(page).toHaveScreenshot('login-screen.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixels: 250,
  });

  const results = await new AxeBuilder({ page })
    .exclude('#loginScreen [aria-hidden="true"]')
    .analyze();
  const serious = results.violations.filter(v => ['critical', 'serious'].includes(v.impact));
  expect(serious, serious.map(v => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
});

test('mobile login does not overflow horizontally', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
