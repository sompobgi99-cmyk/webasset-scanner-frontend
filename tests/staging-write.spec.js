const { test, expect } = require('@playwright/test');

const STAGING_FRONTEND_URL =
  process.env.ITAM_STAGING_FRONTEND_URL ||
  'https://sompobgi99-cmyk.github.io/webasset-scanner-frontend/staging/';
const STAGING_GAS_API_URL =
  process.env.ITAM_STAGING_GAS_API_URL ||
  'https://script.google.com/macros/s/AKfycbwiSgyrenecigwM_vWGskOBW89VHANt8qDR03ABk0_rs_caS_pBPL5kgdrmZXpSpcl9/exec';
const STAGING_USERNAME = process.env.ITAM_STAGING_USERNAME || '';
const STAGING_PASSWORD = process.env.ITAM_STAGING_PASSWORD || '';

function parseResult(value) {
  if (typeof value !== 'string') return value;
  return JSON.parse(value);
}

async function gasPost(apiUrl, userAgent, payload) {
  const first = await fetch(apiUrl, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
      'User-Agent': userAgent,
    },
    body: JSON.stringify(payload),
  });
  const location = first.headers.get('location');
  if (!location) throw new Error(`GAS redirect missing (${first.status})`);
  const response = await fetch(location, {
    headers: { 'User-Agent': userAgent },
  });
  const data = await response.json();
  if (!data || data.ok !== true) {
    throw new Error((data && data.error) || 'Staging API request failed');
  }
  return data.result;
}

test('Staging supports the complete Asset write lifecycle and cleans up', async ({ page }) => {
  test.skip(
    !STAGING_USERNAME || !STAGING_PASSWORD,
    'Set ITAM_STAGING_USERNAME and ITAM_STAGING_PASSWORD to run write QA.'
  );
  test.setTimeout(360_000);

  await page.goto(STAGING_FRONTEND_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('#loginUsername').fill(STAGING_USERNAME);
  await page.locator('#loginPassword').fill(STAGING_PASSWORD);
  await page.locator('#loginSubmitBtn').click();
  await expect(page.locator('#appRoot')).not.toHaveClass(/hidden/, { timeout: 60_000 });

  const token = await page.evaluate(() =>
    sessionStorage.getItem('itam.session.token.v1')
  );
  const userAgent = await page.evaluate(() => navigator.userAgent);
  expect(token).toBeTruthy();

  const call = async (name, args = []) =>
    gasPost(STAGING_GAS_API_URL, userAgent, {
      funcName: 'apiCall',
      apiName: name,
      token,
      argsJson: JSON.stringify(args),
      apiUserAgent: userAgent,
      userAgent,
    });

  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const tag = `QA-STAGING-${stamp}`;
  let assetId = '';
  let campaignId = '';

  try {
    const initial = parseResult(await call('getInitialDataJson'));
    const deviceType = initial.deviceTypes?.[0]?.device_type || 'PC';
    const department = initial.departments?.[0]?.department || '';

    const created = await call('createAsset', [{
      asset_tag: tag,
      computer_name: 'QA STAGING E2E',
      device_type: deviceType,
      department,
      status: 'In Stock',
      remark: 'Automated Staging write verification',
    }]);
    assetId = String(created.asset_id || '');
    expect(assetId).toBeTruthy();

    const updated = await call('updateAsset', [{
      ...created,
      asset_id: assetId,
      asset_tag: tag,
      device_type: deviceType,
      remark: 'Automated Staging update verified',
    }]);
    expect(updated.ok).toBe(true);

    const checkout = parseResult(await call('checkoutAssets', [{
      asset_ids: [assetId],
      mode: 'borrow',
      owner: 'QA Automation',
      department,
      remark: 'Staging E2E',
      print_slip: false,
    }]));
    expect(checkout.count).toBe(1);

    const checkin = parseResult(await call('checkinAssets', [{
      asset_ids: [assetId],
      remark: 'Staging E2E return',
    }]));
    expect(checkin.count).toBe(1);

    const map = parseResult(await call('getMapDataJson', [{
      department: initial.mapDepartments?.[0]?.department || department,
      asset_department: '',
    }]));
    if (map.department) {
      const placed = await call('saveAssetPosition', [{
        asset_id: assetId,
        department: map.department,
        floor_plan_id: map.floorPlan?.floor_plan_id || '',
        pos_x: 100,
        pos_y: 100,
      }]);
      expect(placed.ok).toBe(true);
    }

    const auditData = parseResult(await call('getAuditDataJson'));
    const auditType = auditData.templates?.[0]?.audit_type;
    if (auditType) {
      const campaignResult = parseResult(await call('createAuditCampaign', [{
        audit_type: auditType,
        name: `QA Staging ${stamp}`,
        scope_type: 'all',
        scope_value: [],
      }]));
      campaignId = String(campaignResult.campaign?.campaign_id || '');
      expect(campaignId).toBeTruthy();

      const record = parseResult(await call('recordAuditAssetJson', [{
        campaign_id: campaignId,
        lookup: tag,
        result: 'pass',
        answers: {},
        notes: 'Automated Staging verification',
      }]));
      expect(record.ok).toBe(true);
    }
  } finally {
    if (campaignId) {
      await call('deleteAuditCampaignJson', [campaignId]).catch(() => {});
    }
    if (assetId) {
      await call('deleteAssets', [[assetId]]).catch(() => {});
      await call('purgeDeletedAsset', [assetId]).catch(() => {});
    }
    await call('flushSupabaseBackupQueueJson').catch(() => {});
  }

  const search = parseResult(await call('getAssetManagementDataJson', [
    JSON.stringify({ search: tag, page: 1, page_size: 50 }),
  ]));
  expect(search.pagination?.total || 0).toBe(0);

  const parity = parseResult(await call('getSupabasePilotStatusJson'));
  expect(parity.ready_for_read_pilot).toBe(true);
});
