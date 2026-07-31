const { test, expect } = require('@playwright/test');

const STAGING_FRONTEND_URL =
  process.env.ITAM_STAGING_FRONTEND_URL ||
  'https://sompobgi99-cmyk.github.io/webasset-scanner-frontend/staging/';
const STAGING_GAS_API_URL =
  process.env.ITAM_STAGING_GAS_API_URL ||
  'https://script.google.com/macros/s/AKfycbwiSgyrenecigwM_vWGskOBW89VHANt8qDR03ABk0_rs_caS_pBPL5kgdrmZXpSpcl9/exec';
const STAGING_USERNAME = process.env.ITAM_STAGING_USERNAME || '';
const STAGING_PASSWORD = process.env.ITAM_STAGING_PASSWORD || '';
const STAGING_SUPABASE_URL = 'https://xnxcwpdjptfoigtsvoyl.supabase.co';
const STAGING_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_tdpG_IHZ0ksHFmwziZHxpw_fDVq8UFn';
const GAS_REQUEST_TIMEOUT_MS = 60_000;
const GAS_READ_RETRY_NAMES = new Set([
  'getAssetManagementDataJson',
  'getAuditDataJson',
  'getInitialDataJson',
  'getMapDataJson',
  'getSupabaseAuthStatusJson',
  'getSupabasePilotStatusJson',
  'getSupabaseSyncStatusJson',
]);

function parseResult(value) {
  if (typeof value !== 'string') return value;
  return JSON.parse(value);
}

function loginMetrics(result) {
  return {
    provider: result.provider,
    shellWallMs: result.shellWallMs,
    shellMs: result.shellMs,
    authMs: result.authMs,
    bridgeMs: result.bridgeMs,
    interactiveMs: result.interactiveMs,
    serverTiming: result.serverTiming,
    clientAuthTiming: result.clientAuthTiming,
  };
}

function canonicalSupabaseEmail(username) {
  const encoded = Buffer.from(
    String(username || '').trim().toLowerCase(),
    'utf8'
  ).toString('base64url').toLowerCase();
  return `u-${encoded}@auth.bnh-itam.example.com`;
}

async function getSupabaseAccessToken(username, password) {
  const response = await fetchWithTimeout(
    `${STAGING_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: STAGING_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: canonicalSupabaseEmail(username),
        password,
      }),
    },
    GAS_REQUEST_TIMEOUT_MS,
    'Supabase Auth'
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.msg || data.message ||
      `Supabase Auth HTTP ${response.status}`);
  }
  return data.access_token;
}

async function fetchWithTimeout(url, options, timeoutMs, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`${label} timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function gasPost(apiUrl, userAgent, payload, options = {}) {
  const apiName = String(payload.apiName || payload.funcName || 'unknown');
  const timeoutMs = Number(options.timeoutMs || GAS_REQUEST_TIMEOUT_MS);
  const retrySafe = options.retrySafe !== undefined
    ? Boolean(options.retrySafe)
    : GAS_READ_RETRY_NAMES.has(apiName);
  const maxAttempts = retrySafe ? 2 : 1;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const first = await fetchWithTimeout(apiUrl, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          'User-Agent': userAgent,
        },
        body: JSON.stringify(payload),
      }, timeoutMs, `${apiName} POST`);
      const location = first.headers.get('location');
      if (!location) throw new Error(`GAS redirect missing (${first.status})`);
      const response = await fetchWithTimeout(location, {
        headers: { 'User-Agent': userAgent },
      }, timeoutMs, `${apiName} response`);
      const data = await response.json();
      if (!data || data.ok !== true) {
        throw new Error((data && data.error) || 'Staging API request failed');
      }
      console.log('[ITAM_STAGING_API] ' + JSON.stringify({
        apiName,
        attempt,
        durationMs: Date.now() - startedAt,
        ok: true,
      }));
      return data.result;
    } catch (error) {
      lastError = error;
      console.log('[ITAM_STAGING_API] ' + JSON.stringify({
        apiName,
        attempt,
        durationMs: Date.now() - startedAt,
        ok: false,
        error: String(error && error.message ? error.message : error),
      }));
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  throw new Error(
    `${apiName} failed after ${maxAttempts} attempt(s): ` +
    String(lastError && lastError.message ? lastError.message : lastError)
  );
}

test('Staging supports the complete Asset write lifecycle and cleans up', async ({ page }) => {
  test.skip(
    !STAGING_USERNAME || !STAGING_PASSWORD,
    'Set ITAM_STAGING_USERNAME and ITAM_STAGING_PASSWORD to run write QA.'
  );
  test.setTimeout(360_000);

  const login = async () => {
    await page.goto(STAGING_FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#loginForm')).toBeVisible({ timeout: 30_000 });
    await page.locator('#loginUsername').fill(STAGING_USERNAME);
    await page.locator('#loginPassword').fill(STAGING_PASSWORD);
    const startedAt = Date.now();
    await page.locator('#loginSubmitBtn').click();
    await expect(page.locator('#appRoot')).not.toHaveClass(/hidden/, {
      timeout: 2_000,
    });
    const shellWallMs = Date.now() - startedAt;
    await expect.poll(
      () => page.evaluate(() =>
        sessionStorage.getItem('itam.session.token.v1')
      ),
      { timeout: 60_000 }
    ).toBeTruthy();
    await expect(page.locator('#appRoot')).not.toHaveClass(/authPending/, {
      timeout: 60_000,
    });
    await expect.poll(
      () => page.evaluate(() =>
        document.documentElement.dataset.loginAuthMs || ''
      ),
      { timeout: 60_000 }
    ).not.toBe('');
    await expect.poll(
      () => page.evaluate(() =>
        document.documentElement.dataset.loginInteractiveMs || ''
      ),
      { timeout: 60_000 }
    ).not.toBe('');
    return page.evaluate((measuredShellMs) => ({
      token: sessionStorage.getItem('itam.session.token.v1'),
      provider: document.documentElement.dataset.authProvider || '',
      shellWallMs: measuredShellMs,
      shellMs: Number(document.documentElement.dataset.loginShellMs || 0),
      authMs: Number(document.documentElement.dataset.loginAuthMs || 0),
      bridgeMs: Number(document.documentElement.dataset.loginBridgeMs || 0),
      interactiveMs: Number(
        document.documentElement.dataset.loginInteractiveMs || 0
      ),
      serverTiming: window.state?.loginServerTiming || null,
      clientAuthTiming: window.state?.loginClientAuthTiming || null,
    }), shellWallMs);
  };
  const relogin = async () => {
    await page.evaluate(() => sessionStorage.clear());
    return login();
  };

  const loginSamples = [];
  let loginResult = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    loginResult = attempt === 0 ? await login() : await relogin();
    const metrics = loginMetrics(loginResult);
    loginSamples.push(metrics.authMs);
    console.log('[ITAM_STAGING_LOGIN] ' + JSON.stringify({
      attempt: attempt + 1,
      ...metrics,
    }));
    expect(loginResult.shellWallMs).toBeLessThan(2_000);
  }
  const sortedAuthSamples = loginSamples.slice().sort((a, b) => a - b);
  const medianAuthMs = sortedAuthSamples[Math.floor(sortedAuthSamples.length / 2)];
  console.log('[ITAM_STAGING_LOGIN_MEDIAN] ' + JSON.stringify({
    samples: loginSamples,
    medianAuthMs,
  }));
  expect(medianAuthMs).toBeLessThan(2_000);
  let token = loginResult.token;
  const userAgent = await page.evaluate(() => navigator.userAgent);
  expect(token).toBeTruthy();
  expect(await page.evaluate(() =>
    window.ITAM_APP_CONFIG?.supabaseAuth?.enabled
  )).toBe(true);

  const call = async (name, args = [], options = {}) =>
    test.step(`API ${name}`, () =>
      gasPost(STAGING_GAS_API_URL, userAgent, {
        funcName: 'apiCall',
        apiName: name,
        token,
        argsJson: JSON.stringify(args),
        apiUserAgent: userAgent,
        userAgent,
      }, options));

  let authStatus = parseResult(await call('getSupabaseAuthStatusJson'));
  if (!authStatus.jit_enabled || !authStatus.exchange_enabled) {
    await call('setSupabaseAuthModeJson', [true, false]);
    loginResult = await relogin();
    console.log('[ITAM_STAGING_LOGIN] ' + JSON.stringify(loginMetrics(loginResult)));
    token = loginResult.token;
    expect(token).toBeTruthy();
    await call('setSupabaseAuthModeJson', [true, true]);
    loginResult = await relogin();
    console.log('[ITAM_STAGING_LOGIN] ' + JSON.stringify(loginMetrics(loginResult)));
    token = loginResult.token;
  } else if (loginResult.provider !== 'supabase') {
    loginResult = await relogin();
    console.log('[ITAM_STAGING_LOGIN] ' + JSON.stringify(loginMetrics(loginResult)));
    token = loginResult.token;
  }
  expect(loginResult.provider).toBe('supabase');

  authStatus = parseResult(await call('getSupabaseAuthStatusJson'));
  expect(authStatus.jit_enabled).toBe(true);
  expect(authStatus.exchange_enabled).toBe(true);

  let syncStatus = parseResult(await call('getSupabaseSyncStatusJson'));
  if (!syncStatus.async_sheet_backup) {
    const asyncBackup = parseResult(
      await call('setSupabaseAsyncSheetBackupJson', [true])
    );
    expect(asyncBackup.async_sheet_backup).toBe(true);
    syncStatus = parseResult(await call('getSupabaseSyncStatusJson'));
  }
  expect(syncStatus.async_sheet_backup).toBe(true);

  const supabaseAccessToken = await getSupabaseAccessToken(
    STAGING_USERNAME,
    STAGING_PASSWORD
  );
  expect(supabaseAccessToken).toBeTruthy();
  const rlsResponse = await fetch(
    `${STAGING_SUPABASE_URL}/rest/v1/assets?select=asset_id&limit=1`,
    {
      headers: {
        apikey: STAGING_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${supabaseAccessToken}`,
      },
    }
  );
  expect(rlsResponse.status).toBe(200);
  expect(await rlsResponse.json()).toBeInstanceOf(Array);

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
    const cleanupOptions = { timeoutMs: 30_000, retrySafe: false };
    if (campaignId) {
      await call(
        'deleteAuditCampaignJson',
        [campaignId],
        cleanupOptions
      ).catch(() => {});
    }
    if (assetId) {
      await call('deleteAssets', [[assetId]], cleanupOptions).catch(() => {});
      await call('purgeDeletedAsset', [assetId], cleanupOptions).catch(() => {});
    }
    await call(
      'flushSupabaseBackupQueueJson',
      [],
      cleanupOptions
    ).catch(() => {});
  }

  const search = parseResult(await call('getAssetManagementDataJson', [
    JSON.stringify({ search: tag, page: 1, page_size: 50 }),
  ]));
  expect(search.pagination?.total || 0).toBe(0);

  const parity = parseResult(await call(
    'getSupabasePilotStatusJson',
    [],
    { timeoutMs: 60_000, retrySafe: false }
  ));
  console.log('[ITAM_STAGING_PARITY] ' + JSON.stringify({
    supabaseBatchMs: Number(parity.supabase_batch_ms || 0),
    supabaseBatchRounds: Number(parity.supabase_batch_rounds || 0),
    tables: Object.keys(parity.tables || {}).length,
  }));
  expect(parity.supabase_batch_ms).toBeLessThan(30_000);
  expect(parity.ready_for_read_pilot).toBe(true);
});
