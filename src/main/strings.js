'use strict';
// Textes des boîtes de dialogue système (le reste de l'interface est traduit côté rendu).
const DIALOG = {
  en: { engine: 'Visual Enhancer folder', ffmpeg: 'ffmpeg.exe', clips: 'Choose clips', clipsFilter: 'Clips', out: 'Output folder' },
  fr: { engine: 'Dossier de Visual Enhancer', ffmpeg: 'ffmpeg.exe', clips: 'Choisir des clips', clipsFilter: 'Clips', out: 'Dossier de sortie' },
};
const dialogText = (lang) => DIALOG[lang] || DIALOG.en;

module.exports = { dialogText };
