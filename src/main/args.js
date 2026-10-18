'use strict';
const path = require('node:path');
const { kind } = require('./media');

const STYLES = [0, 1, 2];
const QUALITIES = ['auto', 'good', 'best', 'max'];
const CODECS = ['h264', 'hevc', 'av1'];
const CONTAINERS = ['mp4', 'mkv', 'mov'];

const clamp = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);

// Tout ce qui vient de l'interface est borné ici avant d'atteindre la ligne de commande.
function sanitizeOptions(o = {}) {
  return {
    style: pick(Number(o.style), STYLES, 2),
    strength: clamp(o.strength, 0, 2, 1),
    compare: o.compare === true,
    tone: clamp(o.tone, 0, 1, 1),
    structure: clamp(o.structure, 0, 1, 1),
    autoMask: o.autoMask !== false,
    quality: pick(o.quality, QUALITIES, 'good'),
    codec: pick(o.codec, CODECS, 'h264'),
    container: pick(o.container, CONTAINERS, 'mp4'),
    parallel: Math.round(clamp(o.parallel, 1, 3, 1)),
  };
}

// Un job = un appel `VE_CLI.exe render`. En mode comparaison, un job par style.
function buildJobs({ files, options, outputDir, presetPath, idPrefix = String(Date.now()) }) {
  const o = sanitizeOptions(options);
  const jobs = [];
  for (const file of files) {
    const k = kind(file);
    if (!k) continue;
    const stem = path.parse(file).name;
    const styles = o.compare ? STYLES : [o.style];
    for (const style of styles) {
      const outDir = o.compare ? path.join(outputDir, stem, `style-${style}`) : outputDir;
      const args = ['render', file, '--style', String(style), '--strength', o.strength.toFixed(2), '--quality', o.quality];
      if (k === 'video') args.push('--codec', o.codec, '--container', o.container);
      args.push('--json', '-o', outDir);
      if (presetPath) args.push('--preset', presetPath);
      jobs.push({ id: `${idPrefix}-${jobs.length}`, file, name: path.basename(file), kind: k, style, outDir, args });
    }
  }
  return jobs;
}

module.exports = { sanitizeOptions, buildJobs, STYLES, QUALITIES, CODECS, CONTAINERS };
