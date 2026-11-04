// Télécharge une build FFmpeg LGPL (scripts/ffmpeg.json), vérifie son SHA-256 contre la somme publiée par BtbN
// dans la même release, et en extrait uniquement ce dont l'installeur a besoin dans build/ffmpeg/.
// Rien de tout ça n'est commité dans git.
//
// BtbN supprime ses builds datées au bout de quelques jours : on ne peut pas en épingler une. On épingle donc la
// branche stable (n8.1) de sa release roulante « latest » ; la version exacte et le commit source de ce qui a été
// embarqué sont relevés dans le binaire et écrits dans build/ffmpeg/SOURCE.txt (obligation LGPL).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'ffmpeg.json'), 'utf8'));
const cache = path.join(root, 'build', '.cache');
const out = path.join(root, 'build', 'ffmpeg');

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// « <sha256>  <fichier> » ; BtbN préfixe parfois le nom d'un « * » (mode binaire).
function expectedSum(text, asset) {
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(\S+)$/i);
    if (m && m[2] === asset) return m[1].toLowerCase();
  }
  return null;
}

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`téléchargement impossible : HTTP ${res.status} (${url})`);
  return res;
}

async function download() {
  fs.mkdirSync(cache, { recursive: true });
  const sums = await (await get(meta.baseUrl + meta.checksums)).text();
  const want = expectedSum(sums, meta.asset);
  if (!want) throw new Error(`${meta.asset} n'apparaît pas dans ${meta.checksums} : BtbN a peut-être renommé ses fichiers`);
  const zip = path.join(cache, `${want.slice(0, 16)}-${meta.asset}`);
  if (fs.existsSync(zip) && sha256(zip) === want) {
    console.log('archive FFmpeg déjà en cache');
    return { zip, sha: want };
  }
  console.log('téléchargement de', meta.baseUrl + meta.asset);
  fs.writeFileSync(zip, Buffer.from(await (await get(meta.baseUrl + meta.asset)).arrayBuffer()));
  const got = sha256(zip);
  if (got !== want) {
    fs.rmSync(zip, { force: true });
    throw new Error(`SHA-256 inattendu pour ${meta.asset} : ${got} (attendu ${want})`);
  }
  return { zip, sha: want };
}

function extract(zip) {
  const tmp = path.join(cache, 'extract');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  // bsdtar (Windows 10+) lit les zip ; `unzip` sert de secours sur Linux/macOS.
  let r = spawnSync('tar', ['-xf', zip, '-C', tmp], { stdio: 'inherit' });
  if (r.status !== 0) r = spawnSync('unzip', ['-q', zip, '-d', tmp], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error("extraction impossible (ni tar ni unzip n'ont lu l'archive)");

  const top = fs.readdirSync(tmp).find((n) => fs.statSync(path.join(tmp, n)).isDirectory());
  const base = path.join(tmp, top);
  const license = fs.readFileSync(path.join(base, 'LICENSE.txt'), 'utf8');
  // garde-fou : l'installeur ne doit jamais embarquer une build GPL ou non libre
  if (!/GNU LESSER GENERAL PUBLIC LICENSE/i.test(license)) throw new Error("LICENSE.txt n'est pas la LGPL : cette archive n'est pas une build LGPL");

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  // ffmpeg.exe et ses DLL ; on laisse de côté ffplay, ffprobe, la documentation et les en-têtes.
  for (const name of fs.readdirSync(path.join(base, 'bin'))) {
    if (/^(ffplay|ffprobe)\.exe$/i.test(name)) continue;
    fs.copyFileSync(path.join(base, 'bin', name), path.join(out, name));
  }
  fs.copyFileSync(path.join(base, 'LICENSE.txt'), path.join(out, 'LICENSE.txt'));
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Version exacte relevée dans le binaire (possible seulement sous Windows : c'est là que l'installeur se construit).
function identify() {
  if (process.platform !== 'win32') return { version: null, config: '' };
  const r = spawnSync(path.join(out, 'ffmpeg.exe'), ['-version'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('le ffmpeg.exe extrait ne démarre pas');
  const version = (r.stdout.match(/^ffmpeg version (\S+)/m) || [])[1] || null;
  const config = (r.stdout.match(/^configuration:(.*)$/m) || [])[1] || '';
  if (/--enable-(gpl|nonfree)\b/.test(config)) throw new Error('cette build est compilée avec --enable-gpl ou --enable-nonfree : refusée');
  return { version, config };
}

function writeSource({ sha }, { version }) {
  const hash = version && (version.match(/-g([0-9a-f]{7,40})/) || [])[1];
  const lines = [
    meta.name,
    `FFmpeg ${version || `(branche ${meta.branch}, version relevée à la construction de l'installeur)`}, licence LGPL (voir LICENSE.txt).`,
    hash ? `Code source exact de cette build : ${meta.sourceCommit}${hash}` : `Code source : https://github.com/FFmpeg/FFmpeg (branche release/${meta.branch.replace(/^n/, '')})`,
    `Scripts de build : ${meta.buildScripts} (release « latest », fichier ${meta.asset}, SHA-256 ${sha})`,
    `Téléchargée le ${new Date().toISOString().slice(0, 10)}. Cette copie n'est pas modifiée.`,
    `Tu peux la remplacer par ton propre ffmpeg.exe dans les réglages de l'app.`,
    '',
  ];
  fs.writeFileSync(path.join(out, 'SOURCE.txt'), lines.join('\n'));
}

module.exports = { expectedSum };

if (require.main === module) {
  (async () => {
    const dl = await download();
    extract(dl.zip);
    const id = identify();
    writeSource(dl, id);
    const files = fs.readdirSync(out);
    if (!files.includes('ffmpeg.exe')) throw new Error('ffmpeg.exe absent après extraction');
    console.log(`FFmpeg ${id.version || meta.branch} prêt dans ${path.relative(root, out)} (${files.length} fichiers)`);
  })().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
