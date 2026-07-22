const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const pass = (message) => console.log(`OK: ${message}`);

const requiredFiles = [
  'index.html',
  'app.config.js',
  '.nojekyll',
  'JS_Scan.js',
  'JS_Dashboard.js',
  'JS_AssetManagement.js',
  'JS_CheckoutInventory.js',
  'JS_Audit.js',
  'JS_Map.js',
  'JS_QrLabel.js',
  'JS_Settings.js',
];

const stagingFiles = requiredFiles.map((file) => `staging/${file}`);

for (const file of requiredFiles) {
  if (exists(file)) pass(`found ${file}`);
  else fail(`missing ${file}`);
}

for (const file of stagingFiles) {
  if (exists(file)) pass(`found ${file}`);
  else fail(`missing ${file}`);
}

if (process.exitCode) process.exit(process.exitCode);

const index = read('index.html');
const config = read('app.config.js');
const stagingIndex = read('staging/index.html');
const stagingConfig = read('staging/app.config.js');

const textFiles = requiredFiles.filter((file) => file !== '.nojekyll');
textFiles.push(...stagingFiles.filter((file) => !file.endsWith('/.nojekyll')));
for (const file of textFiles) {
  const content = read(file);
  if (content.includes('\u0000')) fail(`${file} contains NUL bytes`);
}

const versionMatch = index.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) fail('index.html does not contain APP_VERSION');
else pass(`APP_VERSION ${versionMatch[1]}`);

if (/<\?!=/.test(index)) fail('index.html still contains Apps Script template markers');
else pass('no Apps Script template markers in index.html');

if (!/gasApiUrl:\s*['"]https:\/\/script\.google\.com\/macros\/s\/[^'"]+\/exec['"]/.test(config)) {
  fail('app.config.js does not contain a deployed GAS Web App URL');
} else {
  pass('GAS Web App URL configured');
}

if (!/environment:\s*['"]staging['"]/.test(stagingConfig)) {
  fail('staging/app.config.js is not marked as staging');
} else {
  pass('Staging environment configured');
}

if (/<\?!=/.test(stagingIndex)) fail('staging/index.html still contains Apps Script template markers');
else pass('no Apps Script template markers in staging/index.html');

const tokenPatterns = [
  /github_pat_[A-Za-z0-9_]+/i,
  /ghp_[A-Za-z0-9_]{20,}/i,
  /AIza[0-9A-Za-z\-_]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];

for (const file of textFiles) {
  const content = read(file);
  for (const pattern of tokenPatterns) {
    if (pattern.test(content)) fail(`${file} appears to contain a secret token`);
  }
}
if (!process.exitCode) pass('no obvious static secrets found');

const moduleChecks = [
  ['JS_Scan.js', 'ITAM_SCAN_MODULE'],
  ['JS_Dashboard.js', 'ITAM_DASHBOARD_MODULE'],
  ['JS_AssetManagement.js', 'ITAM_ASSET_MODULE'],
  ['JS_CheckoutInventory.js', 'ITAM_CHECKOUT_MODULE'],
  ['JS_Audit.js', 'ITAM_AUDIT_MODULE'],
  ['JS_Map.js', 'ITAM_MAP_MODULE'],
  ['JS_QrLabel.js', 'ITAM_QR_MODULE'],
  ['JS_Settings.js', 'ITAM_SETTINGS_MODULE'],
];

for (const [file, marker] of moduleChecks) {
  const content = read(file);
  if (content.includes(marker)) pass(`${file} exposes ${marker}`);
  else fail(`${file} missing ${marker}`);
}

const lazyModuleUrls = [
  'JS_Scan.js',
  'JS_Dashboard.js',
  'JS_AssetManagement.js',
  'JS_CheckoutInventory.js',
  'JS_Audit.js',
  'JS_Map.js',
  'JS_QrLabel.js',
  'JS_Settings.js',
];

for (const moduleUrl of lazyModuleUrls) {
  if (index.includes(moduleUrl)) pass(`index references ${moduleUrl}`);
  else fail(`index does not reference ${moduleUrl}`);
}

for (const moduleUrl of lazyModuleUrls) {
  if (stagingIndex.includes(moduleUrl)) pass(`staging/index references ${moduleUrl}`);
  else fail(`staging/index does not reference ${moduleUrl}`);
}

const lazyLeakChecks = [
  'openUserFormModal',
  'submitUserForm',
  'renderUsersList',
];

for (const marker of lazyLeakChecks) {
  if (index.includes(marker)) fail(`lazy module marker leaked into index.html: ${marker}`);
}

const lazyExportLeaks = [
  /window\.ITAM_SETTINGS_MODULE\s*=/,
  /window\.ITAM_SCAN_MODULE\s*=/,
  /window\.ITAM_DASHBOARD_MODULE\s*=/,
  /window\.ITAM_ASSET_MODULE\s*=/,
  /window\.ITAM_CHECKOUT_MODULE\s*=/,
  /window\.ITAM_AUDIT_MODULE\s*=/,
  /window\.ITAM_MAP_MODULE\s*=/,
  /window\.ITAM_QR_MODULE\s*=/,
];

for (const pattern of lazyExportLeaks) {
  if (pattern.test(index)) fail(`lazy module export leaked into index.html: ${pattern}`);
}
if (!process.exitCode) pass('lazy module code stayed out of index.html');

const maxSizes = {
  // Includes the shared accessibility and responsive UI styles.
  'index.html': 365 * 1024,
  'JS_Settings.js': 90 * 1024,
  'JS_AssetManagement.js': 90 * 1024,
  'JS_CheckoutInventory.js': 70 * 1024,
  'JS_Audit.js': 80 * 1024,
  'JS_Map.js': 60 * 1024,
  'JS_Scan.js': 50 * 1024,
};

for (const [file, maxBytes] of Object.entries(maxSizes)) {
  const size = fs.statSync(path.join(root, file)).size;
  if (size > maxBytes) fail(`${file} is ${size} bytes, over budget ${maxBytes}`);
  else pass(`${file} size ${size}/${maxBytes}`);
}


for (const [file, maxBytes] of Object.entries(maxSizes)) {
  const stagingFile = path.join('staging', file);
  const size = fs.statSync(path.join(root, stagingFile)).size;
  if (size > maxBytes) fail(`${stagingFile} is ${size} bytes, over budget ${maxBytes}`);
  else pass(`${stagingFile} size ${size}/${maxBytes}`);
}

if (process.exitCode) {
  console.error('Static frontend sanity check failed.');
  process.exit(process.exitCode);
}

console.log('Static frontend sanity check passed.');
