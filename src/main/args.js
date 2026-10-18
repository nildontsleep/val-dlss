'use strict';
const path = require('node:path');
const { isVideo } = require('./media');

const STYLES = [0, 1, 2];

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
  };
}

// Un job = un appel `VE_CLI.exe render`. En mode comparaison, un job par style.
// Avec la méthode TikTok, le rendu part dans un dossier de travail caché, puis ffmpeg écrit le fichier final.
function buildJobs({ files, options, outputDir, idPrefix = String(Date.now()) }) {
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
        '--quality', 'best',
        '--codec', 'h264',
        '--container', 'mp4',
        '--json',
        '-o', outDir,
      ];
      jobs.push({ id, file, name: path.basename(file), stem, style, tiktok: o.tiktok, outDir, finalDir, args });
    }
  }
  return jobs;
}

module.exports = { sanitizeOptions, buildJobs, STYLES };
