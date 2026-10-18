// Copie GSAP et la police Inter en local : l'app n'a besoin d'aucun réseau (local first).
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'src', 'renderer', 'vendor');
fs.mkdirSync(dest, { recursive: true });

const copy = (from, to) => fs.copyFileSync(path.join(root, 'node_modules', ...from), path.join(dest, to));
copy(['gsap', 'dist', 'gsap.min.js'], 'gsap.min.js');
copy(['@fontsource-variable', 'inter', 'files', 'inter-latin-wght-normal.woff2'], 'inter.woff2');
for (const [from, to] of [[['gsap', 'LICENSE.txt'], 'GSAP-LICENSE.txt'], [['@fontsource-variable', 'inter', 'LICENSE'], 'Inter-LICENSE.txt']]) {
  if (fs.existsSync(path.join(root, 'node_modules', ...from))) copy(from, to);
}
console.log('gsap et inter copiés dans', path.relative(root, dest));
