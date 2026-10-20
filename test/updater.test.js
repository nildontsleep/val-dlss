'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseVersion, isNewer, pickAsset, checkForUpdate, downloadAsset } = require('../src/main/updater');

const BASE = 'https://github.com/nildontsleep/val-dlss/releases/download/v0.5.0/';
const release = (extra = {}) => ({
  tag_name: 'v0.5.0',
  html_url: 'https://github.com/nildontsleep/val-dlss/releases/tag/v0.5.0',
  draft: false,
  prerelease: false,
  assets: [
    { name: 'Valorant-DLSS-0.5.0-portable.exe', browser_download_url: `${BASE}Valorant-DLSS-0.5.0-portable.exe`, size: 10, digest: `sha256:${'a'.repeat(64)}` },
    { name: 'Valorant-DLSS-Setup-0.5.0.exe', browser_download_url: `${BASE}Valorant-DLSS-Setup-0.5.0.exe`, size: 20, digest: `sha256:${'b'.repeat(64)}` },
  ],
  ...extra,
});
const jsonResponse = (body, ok = true, status = 200) => async () => ({ ok, status, json: async () => body });

test('parseVersion / isNewer', () => {
  assert.deepEqual(parseVersion('v1.2.3').nums, [1, 2, 3]);
  assert.equal(parseVersion('nope'), null);
  assert.equal(isNewer('v0.5.0', '0.4.0'), true);
  assert.equal(isNewer('0.4.0', '0.4.0'), false);
  assert.equal(isNewer('0.3.9', '0.4.0'), false);
  assert.equal(isNewer('1.0.0', '0.99.99'), true);
  assert.equal(isNewer('0.5.0', '0.5.0-beta.1'), true);
  assert.equal(isNewer('0.5.0-beta.1', '0.5.0'), false);
  assert.equal(isNewer('garbage', '0.4.0'), false);
});

test('pickAsset: installer vs portable, only from this repo, digest parsed', () => {
  assert.equal(pickAsset(release(), true).name, 'Valorant-DLSS-Setup-0.5.0.exe');
  assert.equal(pickAsset(release(), true).sha256, 'b'.repeat(64));
  assert.equal(pickAsset(release(), false).name, 'Valorant-DLSS-0.5.0-portable.exe');
  const foreign = release({ assets: [{ name: 'Valorant-DLSS-Setup-0.5.0.exe', browser_download_url: 'https://evil.example/Valorant-DLSS-Setup-0.5.0.exe', size: 1 }] });
  assert.equal(pickAsset(foreign, true), null);
  const noDigest = release({ assets: [{ ...release().assets[1], digest: null }] });
  assert.equal(pickAsset(noDigest, true).sha256, '');
});

test('checkForUpdate: newer release', async () => {
  const r = await checkForUpdate({ current: '0.4.0', installed: true, fetchFn: jsonResponse(release()) });
  assert.equal(r.ok, true);
  assert.equal(r.update.version, '0.5.0');
  assert.equal(r.update.asset.name, 'Valorant-DLSS-Setup-0.5.0.exe');
});

test('checkForUpdate: up to date, draft, prerelease, http error, network error', async () => {
  assert.equal((await checkForUpdate({ current: '0.5.0', installed: true, fetchFn: jsonResponse(release()) })).update, null);
  assert.equal((await checkForUpdate({ current: '0.4.0', installed: true, fetchFn: jsonResponse(release({ prerelease: true })) })).update, null);
  assert.equal((await checkForUpdate({ current: '0.4.0', installed: true, fetchFn: jsonResponse(release({ draft: true })) })).update, null);
  const http = await checkForUpdate({ current: '0.4.0', installed: true, fetchFn: jsonResponse({}, false, 403) });
  assert.deepEqual([http.ok, http.error], [false, 'http 403']);
  const net = await checkForUpdate({ current: '0.4.0', installed: true, fetchFn: async () => { throw new Error('offline'); } });
  assert.deepEqual([net.ok, net.error], [false, 'offline']);
});

test('checkForUpdate: a foreign html_url is replaced by the releases page', async () => {
  const r = await checkForUpdate({ current: '0.4.0', installed: false, fetchFn: jsonResponse(release({ html_url: 'https://evil.example/x' })) });
  assert.equal(r.update.page, 'https://github.com/nildontsleep/val-dlss/releases/latest');
});

function streamFetch(data, size = data.length) {
  return async () => ({
    ok: true,
    status: 200,
    headers: { get: () => String(size) },
    body: (async function* () {
      yield data.subarray(0, 3);
      yield data.subarray(3);
    })(),
  });
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vdlss-upd-'));
const asset = (data, over = {}) => ({
  name: 'Valorant-DLSS-Setup-0.5.0.exe',
  url: `${BASE}Valorant-DLSS-Setup-0.5.0.exe`,
  size: data.length,
  sha256: crypto.createHash('sha256').update(data).digest('hex'),
  ...over,
});

test('downloadAsset: verified file is kept', async () => {
  const data = Buffer.from('installer-bytes');
  const dir = tmp();
  const seen = [];
  const r = await downloadAsset({ asset: asset(data), dir, fetchFn: streamFetch(data), onProgress: (p) => seen.push(p) });
  assert.equal(r.ok, true);
  assert.deepEqual(fs.readFileSync(r.path), data);
  assert.equal(seen.at(-1), 100);
  assert.deepEqual(fs.readdirSync(dir), ['Valorant-DLSS-Setup-0.5.0.exe']);
});

test('downloadAsset: wrong hash, wrong size, missing digest and foreign urls are refused and leave nothing behind', async () => {
  const data = Buffer.from('installer-bytes');
  for (const [over, error] of [
    [{ sha256: 'f'.repeat(64) }, 'hash'],
    [{ size: 999 }, 'size'],
    [{ sha256: '' }, 'nodigest'],
    [{ url: 'https://evil.example/Valorant-DLSS-Setup-0.5.0.exe' }, 'asset'],
    [{ name: '..\\evil.exe' }, 'asset'],
  ]) {
    const dir = tmp();
    const r = await downloadAsset({ asset: asset(data, over), dir, fetchFn: streamFetch(data) });
    assert.deepEqual([r.ok, r.error], [false, error]);
    assert.deepEqual(fs.readdirSync(dir), []);
  }
});
