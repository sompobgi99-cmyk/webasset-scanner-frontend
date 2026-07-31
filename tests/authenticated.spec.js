const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const { loginWithMockApi } = require('./mock-api');

const views = [
  { name: 'ภาพรวม', desktop: '#dashboardTab', mobile: '[data-mobile-view="dashboard"]', view: '#dashboardView' },
  { name: 'Audit', desktop: '#auditTab', mobile: '[data-mobile-view="audit"]', view: '#auditView' },
  { name: 'เบิก-คืน', desktop: '#checkoutTab', mobile: '[data-mobile-view="checkout"]', view: '#checkoutView' },
  { name: 'ตั้งค่าระบบ', desktop: '#settingsTab', mobile: '[data-mobile-view="settings"]', view: '#settingsView' },
  { name: 'สแกน', desktop: '#scanTab', mobile: '[data-mobile-view="scan"]', view: '#scanViewSection' },
  { name: 'จัดการอุปกรณ์', desktop: '#assetManageTab', mobile: '[data-mobile-view="assets"]', view: '#assetManageView' },
];

async function openView(page, target, isMobile) {
  await page.locator(isMobile ? target.mobile : target.desktop).click();
  await expect(page.locator(target.view), target.name).toBeVisible();
}

test('authenticated navigation renders every primary workspace', async ({ page }, testInfo) => {
  await loginWithMockApi(page);
  const isMobile = testInfo.project.name.startsWith('mobile-');
  for (const target of views) await openView(page, target, isMobile);

  const mapSelector = isMobile ? '[data-mobile-view="map"]' : '#mapViewTab';
  await page.locator(mapSelector).click();
  await expect(page.locator('#mapView')).toBeVisible();
  await expect(page.locator('#departmentSelect')).toHaveValue('BNH IT');
});

test('authenticated asset workspace has no serious accessibility violations', async ({ page }) => {
  await loginWithMockApi(page);
  const results = await new AxeBuilder({ page })
    .exclude('canvas')
    .analyze();
  const serious = results.violations.filter(v => ['critical', 'serious'].includes(v.impact));
  expect(serious, serious.map(v => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
});

test('authenticated shell does not overflow the viewport', async ({ page }, testInfo) => {
  await loginWithMockApi(page);
  const isMobile = testInfo.project.name.startsWith('mobile-');
  if (isMobile) {
    await openView(page, views[4], true);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test('asset management exposes the complete asset record', async ({ page }) => {
  await loginWithMockApi(page);
  await page.locator('.assetActionMenu summary').click();
  await page.getByRole('button', { name: 'ดูรายละเอียด' }).click();

  await expect(page.locator('#assetDetailModal')).toHaveClass(/open/);
  await expect(page.locator('#assetDetailTitle')).toHaveText('MOCK-001');
  await expect(page.locator('#assetDetailGrid')).toContainText('ห้อง QA ชั้น 2');
  await expect(page.locator('#assetDetailGrid')).toContainText('เครื่องสำหรับทดสอบระบบ');
  await expect(page.locator('#assetDetailGrid')).toContainText('floor-qa-2');
  await expect(page.locator('#assetDetailGrid')).toContainText('120.5');
  await expect(page.locator('#assetDetailGrid')).toContainText('แก้ไขล่าสุด');
  await expect(page.locator('#assetDetailGrid')).toContainText('2569');
});

test('settings diagnostics renders production monitoring without overflow', async ({ page }, testInfo) => {
  await loginWithMockApi(page);
  const isMobile = testInfo.project.name.startsWith('mobile-');
  await openView(page, views[3], isMobile);
  await page.locator('[data-settings-tab="diagnostics"]').click();

  await expect(page.locator('#diagProductionStatus')).toHaveText('HEALTHY', { timeout: 10_000 });
  await expect(page.locator('#diagSupabaseProbe')).toContainText('84 ms');
  await expect(page.locator('#diagBackupQueue')).toHaveText('ไม่มีงานค้าง');
  await expect(page.locator('#diagSnapshotStatus')).toContainText('6 / 6');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(overflow).toBe(false);
});
