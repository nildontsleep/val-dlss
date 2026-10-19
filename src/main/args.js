'use strict';
const path = require('node:path');
const { isVideo } = require('./media');

const STYLES = [0, 1, 2];
const QUALITIES = ['auto', 'good', 'best', 'max'];
const LANGS = ['en', 'fr'];

const clamp = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

// Tout ce qui vient de l'interface est borné ici avant d'atteindre la ligne de commande.
function sanitizeOptions(o = {}) {
  return {
    style: STYLES.includes(Number(o.style)) ? Number(o.style) : 2,
    strength: clamp(o.strength, 0, 2, 1),
    compare: o.compare === true,
    tiktok: o.tiktok !== false,
    tone: clamp(o.tone, 0, 1, 1),
    structure: clamp(o.structure, 0, 1, 1),
    skin: clamp(o.skin, 0, 1, 1),
    passes: Math.round(clamp(o.passes, 1, 3, 1)),
    autoMask: o.autoMask === true,
    quality: QUALITIES.includes(o.quality) ? o.quality : 'best',
  };
}

// Les presets de l'app : un nom et les réglages « de rendu » (pas TikTok ni Comparer).
const PRESET_KEYS = ['style', 'strength', 'tone', 'structure', 'skin', 'passes', 'autoMask', 'quality'];
const pickPresetValues = (o) => {
  const s = sanitizeOptions(o);
  return Object.fromEntries(PRESET_KEYS.map((k) => [k, s[k]]));
};

function sanitizePresets(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const p of list.slice(0, 30)) {
    const id = typeof p?.id === 'string' && /^[\w-]{1,40}$/.test(p.id) ? p.id : null;
    const name = typeof p?.name === 'string' ? p.name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) : '';
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, values: pickPresetValues(p.values) });
  }
  return out;
}

// Un job = un appel `VE_CLI.exe render`. En mode comparaison, un job par style.
// Avec la méthode TikTok, le rendu part dans un dossier de travail caché, puis ffmpeg écrit le fichier final.
function buildJobs({ files, options, outputDir, presetPath = null, idPrefix = String(Date.now()) }) {
  const o = sanitizeOptions(options);
  const jobs = [];
  for (const file of files) {
    if (!isVideo(file)) continue;
    const stem = path.parse(file).name;
    for (const style of o.compare ? STYLES : [o.style]) {
      const id = `${idPrefix}-${jobs.length}`;
      const finalDir = o.compare ? path.join(outputDir, stem, `style-${style}`) : outputDir;
      const outDir = o.tiktok ? path.join(finalDir, `.vdlss-${id}`) : finalDir;
      const args = [
        'render', file,
        '--style', String(style),
        '--strength', o.strength.toFixed(2),
        '--quality', o.quality,
        '--codec', 'h264',
        '--container', 'mp4',
        '--json',
        '-o', outDir,
      ];
      if (presetPath) args.push('--preset', presetPath);
      jobs.push({ id, file, name: path.basename(file), stem, style, tiktok: o.tiktok, outDir, finalDir, args });
    }
  }
  return jobs;
}

module.exports = { sanitizeOptions, sanitizePresets, pickPresetValues, buildJobs, STYLES, QUALITIES, LANGS };
