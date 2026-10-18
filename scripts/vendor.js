// Copie GSAP en local pour que l'app n'ait besoin d'aucun réseau (local first).
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'src', 'renderer', 'vendor');
fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(path.join(root, 'node_modules', 'gsap', 'dist', 'gsap.min.js'), path.join(dest, 'gsap.min.js'));
const license = path.join(root, 'node_modules', 'gsap', 'LICENSE.txt');
if (fs.existsSync(license)) fs.copyFileSync(license, path.join(dest, 'GSAP-LICENSE.txt'));
console.log('gsap copié dans', path.relative(root, dest));
