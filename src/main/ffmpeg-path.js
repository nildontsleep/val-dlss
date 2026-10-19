'use strict';
// Ordre de résolution de ffmpeg : choix enregistré -> copie fournie par l'installeur -> dossier de
// Visual Enhancer -> PATH. Les recherches coûteuses ne sont lancées que si nécessaire.
const fs = require('node:fs');
const path = require('node:path');

function bundledFfmpeg(resourcesPath, packaged, exists = fs.existsSync) {
  if (!packaged || !resourcesPath) return '';
  const exe = path.join(resourcesPath, 'ffmpeg', 'ffmpeg.exe');
  return exists(exe) ? exe : '';
}

function pickFfmpeg({ saved, bundled, searchIn, onPath, exists = fs.existsSync }) {
  if (saved && exists(saved)) return saved;
  return bundled || searchIn() || onPath() || '';
}

module.exports = { bundledFfmpeg, pickFfmpeg };
