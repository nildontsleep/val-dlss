'use strict';
// Upscale : `VE_CLI.exe upscale <rendu> --scale N` appliqué au rendu neural, avant le plafond de taille et la méthode TikTok.
// On ne choisit pas de moteur (--engine) : le README de Visual Enhancer donne `upscale clip.mp4 --scale 2` pour une vidéo.
const fs = require('node:fs');
const path = require('node:path');
const { run, lastLine, findVideo } = require('./tiktok');

const SCALES = [2, 4];

function detailOf(r) {
  try {
    const j = JSON.parse(r.stdout);
    const d = j.items?.[0]?.error || j.error;
    if (d) return String(d);
  } catch {
    /* sortie non JSON */
  }
  return lastLine(r.stderr) || lastLine(r.stdout) || `code ${r.code}`;
}

// Vérifie sans rien traiter que Visual Enhancer accepte la demande (`--dry-run`), avant de lancer un long rendu.
async function validateUpscale({ exe, prefix = [], file, scale }) {
  const r = await run(exe, [...prefix, 'upscale', file, '--scale', String(scale), '--dry-run', '--json']);
  let plan = null;
  try {
    plan = JSON.parse(r.stdout);
  } catch {
    /* sortie non JSON */
  }
  if (plan && plan.ok === false) return { ok: false, detail: detailOf(r) };
  if (!plan && r.code !== 0) return { ok: false, detail: detailOf(r) };
  return { ok: true };
}

// Remplace `file` par sa version agrandie (`<nom>_x2.mp4`). Ne lève jamais : en cas d'échec, le rendu reste intact.
async function upscaleFile({ exe, prefix = [], file, scale, track, isCancelled = () => false }) {
  const dir = path.dirname(file);
  const outDir = path.join(dir, 'up');
  const cleanup = () => fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const r = await run(exe, [...prefix, 'upscale', file, '--scale', String(scale), '--json', '-o', outDir], track);
  if (isCancelled()) {
    cleanup();
    return { status: 'cancelled' };
  }
  let produced = null;
  if (r.code === 0) {
    try {
      const p = JSON.parse(r.stdout).items?.[0]?.output_path;
      if (p && fs.existsSync(p)) produced = p;
    } catch {
      /* pas de JSON : on cherche le fichier */
    }
    if (!produced) {
      try {
        produced = findVideo(outDir);
      } catch {
        /* dossier absent */
      }
    }
  }
  if (!produced) {
    const detail = r.code === 0 ? 'no output file' : detailOf(r);
    cleanup();
    return { status: 'failed', detail };
  }
  const { name, ext } = path.parse(file);
  const dest = path.join(dir, `${name}_x${scale}${path.extname(produced) || ext}`);
  fs.renameSync(produced, dest);
  fs.rmSync(file, { force: true });
  cleanup();
  return { status: 'done', file: dest, scale };
}

function noteForUpscale(res) {
  if (res.status === 'done') return { code: 'upscale_done', params: { scale: res.scale } };
  if (res.status === 'failed') return { code: 'upscale_failed', params: { detail: res.detail } };
  return null;
}

module.exports = { SCALES, validateUpscale, upscaleFile, noteForUpscale };
