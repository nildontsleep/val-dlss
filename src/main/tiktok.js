'use strict';
// Méthode qualité TikTok de paschafps : ffmpeg réécrit les timestamps (-itsscale) sans ré-encoder.
// Équivalent exact de la commande du script d'origine :
//   ffmpeg -y -itsscale <N> -i <entrée> -c:v copy -c:a copy <sortie>
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { isVideo } = require('./media');

const SCALES = [[60, 2], [120, 6], [240, 12]];

function parseFps(text) {
  const line = String(text).split(/\r?\n/).find((l) => /Stream #.*Video:/.test(l));
  if (!line) return null;
  const m = line.match(/(\d+(?:\.\d+)?)\s*fps/) || line.match(/(\d+(?:\.\d+)?)\s*tbr/);
  return m ? parseFloat(m[1]) : null;
}

function scaleFor(fps) {
  if (!Number.isFinite(fps)) return null;
  const hit = SCALES.find(([n]) => Math.abs(fps - n) <= 1);
  return hit ? hit[1] : null;
}

function run(exe, args, track) {
  return new Promise((resolve) => {
    let stderr = '';
    const child = spawn(exe, args, { windowsHide: true });
    if (track) track(child);
    child.stdout.on('data', () => {});
    child.stderr.on('data', (d) => {
      if (stderr.length < 20000) stderr += d;
    });
    child.on('error', (e) => resolve({ code: -1, stderr: e.message }));
    child.on('close', (code) => resolve({ code, stderr }));
  });
}

const lastLine = (text) => String(text).trim().split(/\r?\n/).filter(Boolean).pop() || '';

function uniquePath(dir, stem, ext) {
  let p = path.join(dir, stem + ext);
  for (let i = 2; fs.existsSync(p); i++) p = path.join(dir, `${stem} (${i})${ext}`);
  return p;
}

function findVideo(dir) {
  let best = null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isFile() || !isVideo(e.name)) continue;
    const p = path.join(dir, e.name);
    const size = fs.statSync(p).size;
    if (!best || size > best.size) best = { p, size };
  }
  return best && best.p;
}

// Applique la méthode au rendu de `workDir`. En cas d'échec, le rendu est conservé tel quel dans `finalDir`.
async function finish({ ffmpeg, prefix = [], workDir, finalDir, stem, track, isCancelled = () => false }) {
  const cleanup = () => {
    if (path.basename(workDir).startsWith('.vdlss-')) fs.rmSync(workDir, { recursive: true, force: true });
  };
  let rendered = null;
  try {
    rendered = findVideo(workDir);
  } catch {
    /* dossier absent */
  }
  if (!rendered) {
    cleanup();
    return { ok: false, error: 'Aucun rendu trouvé' };
  }
  const keep = () => {
    const { name, ext } = path.parse(rendered);
    const dest = uniquePath(finalDir, name, ext);
    fs.renameSync(rendered, dest);
    cleanup();
    return dest;
  };

  const fps = parseFps((await run(ffmpeg, [...prefix, '-hide_banner', '-i', rendered], track)).stderr);
  const scale = scaleFor(fps);
  if (!scale) {
    const error = fps
      ? `${fps} fps : la méthode gère 60, 120 ou 240 fps. Rendu conservé tel quel.`
      : 'fps introuvable. Rendu conservé tel quel.';
    return { ok: false, error, output: keep() };
  }
  if (isCancelled()) return { ok: false, cancelled: true, output: keep() };

  const output = uniquePath(finalDir, `${stem}_tiktok`, '.mp4');
  const r = await run(ffmpeg, [...prefix, '-y', '-itsscale', String(scale), '-i', rendered, '-c:v', 'copy', '-c:a', 'copy', output], track);
  if (r.code !== 0 || !fs.existsSync(output)) {
    fs.rmSync(output, { force: true });
    if (isCancelled()) return { ok: false, cancelled: true, output: keep() };
    return { ok: false, error: `${lastLine(r.stderr) || 'ffmpeg a échoué'}. Rendu conservé tel quel.`, output: keep() };
  }
  cleanup();
  return { ok: true, output, fps, scale };
}

// ffmpeg.exe : dossier de Visual Enhancer d'abord, puis le PATH. Sinon l'utilisateur le choisit.
const FFMPEG_NAMES = process.platform === 'win32' ? ['ffmpeg.exe'] : ['ffmpeg', 'ffmpeg.exe'];

function findFfmpegIn(dir, maxDepth = 4, maxEntries = 4000) {
  let seen = 0;
  const walk = (d, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      if (e.isFile() && FFMPEG_NAMES.includes(e.name.toLowerCase())) return path.join(d, e.name);
    }
    if (depth >= maxDepth) return null;
    for (const e of entries) {
      if (!e.isDirectory() || ++seen > maxEntries) continue;
      const hit = walk(path.join(d, e.name), depth + 1);
      if (hit) return hit;
    }
    return null;
  };
  return dir ? walk(dir, 0) : null;
}

function findFfmpegOnPath() {
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8', windowsHide: true });
  return r.status === 0 ? r.stdout.split(/\r?\n/).find(Boolean) || null : null;
}

async function checkFfmpeg(exe, prefix = []) {
  return (await run(exe, [...prefix, '-version'])).code === 0;
}

module.exports = { parseFps, scaleFor, finish, findFfmpegIn, findFfmpegOnPath, checkFfmpeg };
