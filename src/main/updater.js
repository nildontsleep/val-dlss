'use strict';
// Mise à jour : au lancement, une seule requête GET (sans identifiant) vers l'API publique des Releases de ce dépôt.
// Rien n'est installé sans clic : l'installeur téléchargé est vérifié (SHA-256 publié par GitHub) avant d'être lancé.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO = 'nildontsleep/val-dlss';
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const DOWNLOAD_PREFIX = `https://github.com/${REPO}/releases/download/`;
const PAGE_PREFIX = `https://github.com/${REPO}/releases/`;

// "v1.2.3" ou "1.2.3-beta.1" -> [1, 2, 3] (la partie pré-version rend la version plus ancienne que la finale)
function parseVersion(text) {
  const m = String(text).trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  return m ? { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] || '' } : null;
}

function isNewer(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a.nums[i] !== b.nums[i]) return a.nums[i] > b.nums[i];
  return !a.pre && !!b.pre;
}

// Installeur NSIS pour une version installée, exe portable pour la version portable.
function pickAsset(release, installed) {
  const re = installed ? /^Valorant-DLSS-Setup-[\w.-]+\.exe$/ : /^Valorant-DLSS-[\w.-]+-portable\.exe$/;
  const a = (release.assets || []).find((x) => re.test(x.name) && String(x.browser_download_url).startsWith(DOWNLOAD_PREFIX));
  if (!a) return null;
  const digest = /^sha256:([0-9a-f]{64})$/.exec(String(a.digest || ''));
  return { name: a.name, url: a.browser_download_url, size: Number(a.size) || 0, sha256: digest ? digest[1] : '' };
}

async function checkForUpdate({ current, installed, fetchFn = fetch, timeoutMs = 8000 }) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(API_URL, {
      signal: ctl.signal,
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'valorant-dlss-update-check' },
    });
    if (!res.ok) return { ok: false, error: `http ${res.status}` };
    const rel = await res.json();
    if (rel.draft || rel.prerelease || !isNewer(rel.tag_name, current)) return { ok: true, update: null };
    const page = String(rel.html_url).startsWith(PAGE_PREFIX) ? rel.html_url : `${PAGE_PREFIX}latest`;
    return { ok: true, update: { version: String(rel.tag_name).replace(/^v/, ''), page, asset: pickAsset(rel, installed) } };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

// Télécharge l'asset dans `dir`, vérifie sa taille et son SHA-256. Refuse tout ce qui n'est pas vérifiable.
async function downloadAsset({ asset, dir, fetchFn = fetch, onProgress = () => {} }) {
  if (!asset || !asset.url.startsWith(DOWNLOAD_PREFIX) || !/^[\w.-]+\.exe$/.test(asset.name)) return { ok: false, error: 'asset' };
  if (!asset.sha256) return { ok: false, error: 'nodigest' };
  fs.mkdirSync(dir, { recursive: true });
  const final = path.join(dir, asset.name);
  const part = `${final}.part`;
  const out = fs.createWriteStream(part);
  const hash = crypto.createHash('sha256');
  const fail = (error) => {
    out.destroy();
    fs.rmSync(part, { force: true });
    return { ok: false, error };
  };
  try {
    const res = await fetchFn(asset.url, { headers: { 'User-Agent': 'valorant-dlss-update-check' } });
    if (!res.ok || !res.body) return fail(`http ${res.status}`);
    const total = Number(res.headers.get('content-length')) || asset.size;
    let got = 0;
    let last = -1;
    for await (const chunk of res.body) {
      hash.update(chunk);
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      got += chunk.length;
      const pct = total ? Math.floor((got / total) * 100) : 0;
      if (pct !== last) {
        last = pct;
        onProgress(pct);
      }
    }
    await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
    if (asset.size && got !== asset.size) return fail('size');
    if (hash.digest('hex') !== asset.sha256) return fail('hash');
    fs.rmSync(final, { force: true });
    fs.renameSync(part, final);
    return { ok: true, path: final };
  } catch (e) {
    return fail(e.message);
  }
}

module.exports = { parseVersion, isNewer, pickAsset, checkForUpdate, downloadAsset, PAGE_PREFIX };
