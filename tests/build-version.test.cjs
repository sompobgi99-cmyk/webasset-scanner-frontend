const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const projectRoot = path.resolve(__dirname, '..');
const distCandidate = path.join(projectRoot, 'dist');
const distDir = fs.existsSync(path.join(distCandidate, 'build-version.txt'))
  ? distCandidate
  : projectRoot;

test('published frontend contains one generated build version', () => {
  const version = fs.readFileSync(path.join(distDir, 'build-version.txt'), 'utf8').trim();
  const index = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

  assert.match(version, /^[0-9A-Za-z._-]+$/);
  assert.ok(version.length >= 8, 'build version is unexpectedly short');
  assert.ok(index.includes(version), 'index.html does not contain build-version.txt value');
  assert.ok(!index.includes('2026-07-22.scan-map-mobile-v134'), 'static build retained the source fallback version');
});

test('external bundles match their content hashes and are referenced by the page', () => {
  const crypto = require('node:crypto');
  const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'asset-manifest.json'), 'utf8'));
  const index = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  for (const kind of ['css', 'js']) {
    const file = manifest[kind];
    const bytes = fs.readFileSync(path.join(distDir, file));
    const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    assert.equal(file, `app.${hash}.${kind}`);
    assert.ok(index.includes(file));
  }
});
