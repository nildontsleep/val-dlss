// Faux VE_CLI : imite la CLI de Visual Enhancer pour tester Engine sans GPU ni Windows.
const fs = require('node:fs');
const path = require('node:path');
const [cmd, input, ...rest] = process.argv.slice(2);
const flag = (n) => (rest.includes(n) ? rest[rest.indexOf(n) + 1] : undefined);
const has = (n) => rest.includes(n);
const out = flag('-o');
const fail = (message, code = 2) => {
  console.log(JSON.stringify({ ok: false, error: message }));
  process.exit(code);
};

if (flag('--preset')) {
  let preset;
  try {
    preset = JSON.parse(fs.readFileSync(flag('--preset'), 'utf8'));
  } catch {
    fail('Preset illisible');
  }
  if (preset.format !== 'dlss5-visual-enhancer-settings-preset') fail('Format de preset invalide');
  if (preset.schema_version > Number(process.env.FAKE_MAX_SCHEMA || 38)) fail(`schema_version ${preset.schema_version} non pris en charge`);
  if (process.env.FAKE_PRESET_LOG) fs.appendFileSync(process.env.FAKE_PRESET_LOG, JSON.stringify(preset.settings) + '\n');
}
if (has('--dry-run')) {
  console.log(JSON.stringify({ ok: true, dry_run: true, total: 1, items: [{ input_path: input, stages: ['neural_model', 'export'] }] }));
  process.exit(0);
}
if (input && input.includes('fail')) {
  console.error('Error: fichier illisible');
  console.log(JSON.stringify({ ok: false, items: [{ state: 'failed', error: 'fichier illisible' }] }));
  process.exit(1);
}

const isImage = /\.(png|jpe?g)$/i.test(input);
// Comme la vraie CLI : un clip situé dans le dossier de sortie n'est pas pris en entrée.
if (!isImage && path.resolve(path.dirname(input)) === path.resolve(out)) fail(`No supported images or videos found: ${input}`);
const target = isImage ? out : path.join(out, `${path.parse(input).name}_Neural_Rendering.mp4`);
let p = 0;
const timer = setInterval(() => {
  p += 25;
  process.stderr.write(`Rendering ${p}%\r`);
  if (p >= 100) {
    clearInterval(timer);
    if (fs.existsSync(target)) fail('Le fichier existe déjà', 1);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, isImage ? 'png-result' : input); // le contenu rappelle l'entrée : le faux ffmpeg y lit les fps
    if (process.env.FAKE_OUT_BYTES) fs.truncateSync(target, Number(process.env.FAKE_OUT_BYTES)); // fichier creux : une taille sans écrire les octets
    console.log(JSON.stringify({ ok: true, items: [{ input_path: input, output_path: target, state: 'complete' }] }));
  }
}, Number(process.env.FAKE_STEP_MS || 20));
process.on('SIGTERM', () => process.exit(143));
