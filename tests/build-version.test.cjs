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
