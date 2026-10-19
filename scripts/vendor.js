// Copie GSAP et les polices en local : l'app n'a besoin d'aucun réseau (local first).
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'src', 'renderer', 'vendor');
fs.mkdirSync(dest, { recursive: true });

const FILES = [
  [['gsap', 'dist', 'gsap.min.js'], 'gsap.min.js'],
  [['gsap', 'LICENSE.txt'], 'GSAP-LICENSE.txt'],
  [['@fontsource-variable', 'inter', 'files', 'inter-latin-wght-normal.woff2'], 'inter.woff2'],
  [['@fontsource-variable', 'inter', 'LICENSE'], 'Inter-LICENSE.txt'],
  [['@fontsource', 'instrument-serif', 'files', 'instrument-serif-latin-400-normal.woff2'], 'instrument-serif.woff2'],
  [['@fontsource', 'instrument-serif', 'files', 'instrument-serif-latin-400-italic.woff2'], 'instrument-serif-italic.woff2'],
  [['@fontsource', 'instrument-serif', 'LICENSE'], 'InstrumentSerif-LICENSE.txt'],
  [['@fontsource', 'jetbrains-mono', 'files', 'jetbrains-mono-latin-400-normal.woff2'], 'jetbrains-mono.woff2'],
  [['@fontsource', 'jetbrains-mono', 'files', 'jetbrains-mono-latin-500-normal.woff2'], 'jetbrains-mono-500.woff2'],
  [['@fontsource', 'jetbrains-mono', 'LICENSE'], 'JetBrainsMono-LICENSE.txt'],
];
for (const [from, to] of FILES) {
  const src = path.join(root, 'node_modules', ...from);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, to));
  else if (!to.endsWith('LICENSE.txt')) throw new Error(`fichier manquant : ${src}`);
}
console.log('gsap et polices copiés dans', path.relative(root, dest));
