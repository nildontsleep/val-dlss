'use strict';
// Aperçu d'une image : ffmpeg extrait la frame, Visual Enhancer la rend (pipeline image).
// L'aperçu n'a pas de mouvement entre frames : le rendu vidéo final peut légèrement différer.
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./tiktok');

function parseDuration(text) {
  const m = String(text).match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + parseFloat(m[3]) : null;
}

async function probeDuration({ ffmpeg, prefix = [], file, track }) {
  const r = await run(ffmpeg, [...prefix, '-hide_banner', '-i', file], track);
  return parseDuration(r.stderr);
}

async function extractFrame({ ffmpeg, prefix = [], file, time, out, track }) {
  const r = await run(ffmpeg, [...prefix, '-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.max(0, time)), '-i', file, '-frames:v', '1', '-an', out], track);
  return r.code === 0 && fs.existsSync(out);
}

// Visual Enhancer refuse d'écraser un fichier : chaque rendu a un nom unique.
let counter = 0;
const uniqueName = (dir, stem, ext) => path.join(dir, `${stem}-${process.pid}-${Date.now()}-${counter++}${ext}`);

async function renderFrame({ exe, prefix = [], input, out, style, strength, presetPath, track }) {
  const args = [...prefix, 'render', input, '--style', String(style), '--strength', strength.toFixed(2), '--format', 'png', '--json', '-o', out];
  if (presetPath) args.push('--preset', presetPath);
  const r = await run(exe, args, track);
  if (r.code === 0 && fs.existsSync(out)) return { ok: true };
  let detail = '';
  try {
    detail = JSON.parse(r.stdout).items?.[0]?.error || JSON.parse(r.stdout).error || '';
  } catch {
    /* pas de JSON */
  }
  return { ok: false, detail: detail || String(r.stderr).trim().split(/\r?\n/).filter(Boolean).pop() || `code ${r.code}` };
}

const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

module.exports = { parseDuration, probeDuration, extractFrame, renderFrame, uniqueName, dataUrl };
