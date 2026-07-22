const { test, expect } = require('@playwright/test');
const { loginWithMockApi } = require('./mock-api');

function captureRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function scanAndOpenMap(page) {
  await page.locator('[data-mobile-view="scan"]').click();
  await expect(page.locator('#scanViewSection')).toBeVisible();

  await page.locator('#scanManualInput').fill('MOCK-001');
  await page.locator('#scanManualBtn').click();
  await expect(page.locator('#scanResult')).toContainText('MOCK-001');

  const mapButton = page.locator('[data-scan-action="map"]');
  await expect(mapButton).toBeEnabled();
  await mapButton.click();

  await expect(page.locator('#mapView')).toBeVisible();
  await expect(page.locator('#departmentSelect')).toHaveValue('BNH IT');
  await expect(page.locator('#mapView .side')).toHaveClass(/open/);
  await expect(page.locator('#selectedDetails')).toContainText('MOCK-001');
}

test.describe('mobile Scan to Map regression', () => {
  test('opens the exact mapped asset and closes the portrait drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const runtimeErrors = captureRuntimeErrors(page);
    await loginWithMockApi(page);
    await scanAndOpenMap(page);

    await page.locator('#sideCloseBtn').click();
    await expect(page.locator('#mapView .side')).not.toHaveClass(/open/);
    await expect(page.locator('body')).not.toHaveClass(/map-drawer-open/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
    expect(runtimeErrors).toEqual([]);
  });

  test('keeps Scan to Map usable in phone landscape', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    const runtimeErrors = captureRuntimeErrors(page);
    await loginWithMockApi(page);
    await scanAndOpenMap(page);

    await expect(page.locator('#sideCloseBtn')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
    expect(runtimeErrors).toEqual([]);
  });
});
