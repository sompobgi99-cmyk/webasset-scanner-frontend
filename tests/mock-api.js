const { expect } = require('@playwright/test');

const user = {
  username: 'qa-admin',
  name: 'QA Admin',
  role: 'ADMIN',
  department: 'BNH IT',
  must_change_password: false,
};

const deviceTypes = [
  { device_type: 'PC', thai_label: 'คอมพิวเตอร์', icon: 'monitor', color: '#0891b2', sort_order: 1 },
];

const initial = {
  user,
  permissions: [
    'asset.view', 'asset.create', 'asset.edit', 'asset.delete', 'asset.deploy',
    'asset.changeStatus', 'floorplan.upload', 'asset.import', 'report.export',
    'master.manage', 'user.manage',
  ],
  departments: [{ department: 'BNH IT', floor_name: 'Floor 2', sort_order: 1 }],
  mapDepartments: [{ department: 'BNH IT', floor_name: 'Floor 2', sort_order: 1 }],
  deviceTypes,
  statuses: [
    { status: 'In Use', thai_label: 'ใช้งาน', sort_order: 1 },
    { status: 'In Stock', thai_label: 'คลัง', sort_order: 2 },
  ],
  brands: [{ brand: 'Dell', sort_order: 1 }],
  models: [{ brand: 'Dell', model: 'OptiPlex QA', sort_order: 1 }],
  osVersions: [{ os_version: 'Windows 11 Pro', sort_order: 1 }],
  systemSettings: {},
};

const asset = {
  asset_id: 'asset-qa-1',
  asset_tag: 'MOCK-001',
  computer_name: 'BNH-QA-PC01',
  serial_number: 'QA123456',
  brand: 'Dell',
  model: 'OptiPlex QA',
  os_version: 'Windows 11 Pro',
  device_type: 'PC',
  department: 'BNH IT',
  owner: 'QA User',
  status: 'In Use',
  location_desc: 'ห้อง QA ชั้น 2',
  remark: 'เครื่องสำหรับทดสอบระบบ',
  purchase_date: '2025-01-15',
  warranty_expire: '2028-01-15',
  created_at: '2025-01-15T02:30:00.000Z',
  updated_at: '2026-07-20T06:00:00.000Z',
  location: {
    department: 'BNH IT',
    floor_plan_id: 'floor-qa-2',
    pos_x: 120.5,
    pos_y: 88.25,
  },
};

const assetManagement = {
  ok: true,
  assets: [asset],
  summary: { total: 1, inUse: 1, inStock: 0, repair: 0, retired: 0, placed: 0 },
  pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1, start: 1, end: 1 },
  sort: { key: '', dir: '' },
};

const dashboard = {
  generated_at: '2026-07-13T01:00:00.000Z',
  assets: { total: 1, inUse: 1, inStock: 0, repair: 0, borrowed: 0, retired: 0 },
  invTotal: 1,
  lowStock: [],
  warranty: { expired: 0, in30days: 0, in60days: 0, in90days: 0, missing: 0, expiringList: [] },
  age: { oldAssets: 0 },
  topOwners: [{ owner: 'QA User', count: 1 }],
  recentTx: [],
  audit: { active_campaigns: [], recent_issues: [], open_issue_count: 0 },
  byDepartment: [{ label: 'BNH IT', count: 1 }],
  byType: [{ label: 'PC', count: 1 }],
  trend: [],
};

const inventory = {
  items: [{
    inventory_id: 'inv-qa-1', item_name: 'QA Keyboard', device_type: 'Keyboard',
    brand: 'QA', model: 'Model 1', quantity: 5, min_stock: 1,
  }],
  recentTx: [],
};

const checkout = {
  inStock: [],
  borrowed: [],
  inUse: [],
  inUseCount: 1,
  deviceTypes,
  stockPagination: { page: 1, totalPages: 1, total: 0, start: 0, end: 0 },
  borrowedPagination: { page: 1, totalPages: 1, total: 0, start: 0, end: 0 },
};

const audit = {
  templates: [{
    audit_type: 'asset_count', label: 'ตรวจนับทรัพย์สิน', description: 'QA audit',
    enabled: true, questions: [{ key: 'found', label: 'พบอุปกรณ์', type: 'boolean', required: true }],
  }],
  campaigns: [],
  activeCampaigns: [],
  records: [],
  recentIssues: [],
  scopeOptions: { departments: ['BNH IT'], deviceTypes: ['PC'] },
};

const settings = {
  departments: initial.departments,
  mapDepartments: initial.mapDepartments,
  deviceTypes,
  statuses: initial.statuses,
  brands: initial.brands,
  models: initial.models,
  osVersions: initial.osVersions,
};

function jsonResult(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function resultFor(apiName) {
  const responses = {
    loginUser: jsonResult({ ok: true, token: 'qa-token', user, bootstrap: initial }),
    restoreSessionBootstrap: jsonResult({ ok: true, user, bootstrap: initial }),
    validateSession: jsonResult({ ok: true, user }),
    getInitialDataJson: jsonResult(initial),
    getInitialData: jsonResult(initial),
    getAssetManagementDataJson: jsonResult(assetManagement),
    findAssetByTagJson: jsonResult({ ok: true, asset }),
    getDashboardDataJson: jsonResult(dashboard),
    getInventoryDataJson: jsonResult(inventory),
    getCheckoutDataJson: jsonResult(checkout),
    getAuditDataJson: jsonResult(audit),
    getAuditFollowupListJson: jsonResult({ rows: [], summary: { total: 0 } }),
    getSettingsMasterDataJson: jsonResult(settings),
    getSettingsSystemDataJson: jsonResult({ systemSettings: {} }),
    getSettingsAuditTemplatesJson: jsonResult({ auditTemplates: audit.templates }),
    getSettingsTextDiagnosticsJson: jsonResult({ issue_count: 0, issues: [], status: 'ok' }),
    getMapDataJson: jsonResult({
      department: 'BNH IT', assetDepartment: '', floorKey: 'BNH IT', floorPlan: null,
      floorPlanDebug: null, assets: [asset], inventory: [], searchAssets: [asset], audit: [],
      summary: { total: 1, placed: 1, inventory: 0 },
    }),
    getMapInventoryDataJson: jsonResult({
      inventory: [], count: 0, filteredCount: 0, hasMore: false,
    }),
    getHomeWarmupJson: jsonResult({ dashboard, inventory, audit, generated_at: '2026-07-13T01:00:00.000Z' }),
    getSystemLogoJson: jsonResult({}),
  };
  return Object.prototype.hasOwnProperty.call(responses, apiName)
    ? responses[apiName]
    : jsonResult({ ok: true });
}

async function installMockApi(page) {
  await page.route('https://script.google.com/macros/s/**', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.continue();
    let payload = {};
    try { payload = request.postDataJSON() || {}; } catch (e) {}
    const apiName = payload.funcName === 'apiCall'
      ? ((payload.args && payload.args[0]) || payload.apiName || '')
      : payload.funcName;
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ ok: true, result: resultFor(apiName) }),
    });
  });
}

async function loginWithMockApi(page) {
  await installMockApi(page);
  await page.goto('/');
  await page.locator('#loginUsername').fill('qa-admin');
  await page.locator('#loginPassword').fill('qa-password');
  await page.locator('#loginSubmitBtn').click();
  await expect(page.locator('#assetManageView')).toBeVisible();
  await expect(page.getByText('MOCK-001', { exact: true })).toBeVisible();
}

module.exports = { installMockApi, loginWithMockApi };
