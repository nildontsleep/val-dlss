// Télécharge la build FFmpeg LGPL épinglée (scripts/ffmpeg.json), vérifie son SHA-256 et en extrait
// uniquement ce dont l'installeur a besoin dans build/ffmpeg/. Rien de tout ça n'est commité dans git.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'ffmpeg.json'), 'utf8'));
const cache = path.join(root, 'build', '.cache');
const out = path.join(root, 'build', 'ffmpeg');
const zip = path.join(cache, meta.asset);

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function download() {
  fs.mkdirSync(cache, { recursive: true });
  if (fs.existsSync(zip) && sha256(zip) === meta.sha256) {
    console.log('archive FFmpeg déjà en cache');
    return;
  }
  console.log('téléchargement de', meta.url);
  const res = await fetch(meta.url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`téléchargement impossible : HTTP ${res.status}`);
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  const got = sha256(zip);
  if (got !== meta.sha256) {
    fs.rmSync(zip, { force: true });
    throw new Error(`SHA-256 inattendu pour ${meta.asset} : ${got} (attendu ${meta.sha256})`);
  }
}

function extract() {
  const tmp = path.join(cache, 'extract');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  // bsdtar (Windows 10+) lit les zip ; `unzip` sert de secours sur Linux/macOS.
  let r = spawnSync('tar', ['-xf', zip, '-C', tmp], { stdio: 'inherit' });
  if (r.status !== 0) r = spawnSync('unzip', ['-q', zip, '-d', tmp], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error("extraction impossible (ni tar ni unzip n'ont lu l'archive)");

  const top = fs.readdirSync(tmp).find((n) => fs.statSync(path.join(tmp, n)).isDirectory());
  const base = path.join(tmp, top);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  // ffmpeg.exe et ses DLL ; on laisse de côté ffplay, ffprobe, la documentation et les en-têtes.
  for (const name of fs.readdirSync(path.join(base, 'bin'))) {
    if (/^(ffplay|ffprobe)\.exe$/i.test(name)) continue;
    fs.copyFileSync(path.join(base, 'bin', name), path.join(out, name));
  }
  fs.copyFileSync(path.join(base, 'LICENSE.txt'), path.join(out, 'LICENSE.txt'));
  fs.writeFileSync(
    path.join(out, 'SOURCE.txt'),
    [
      `${meta.name}`,
      `FFmpeg ${meta.ffmpegVersion}, licence LGPL (voir LICENSE.txt).`,
      `Code source exact de cette build : ${meta.source}`,
      `Scripts de build : ${meta.buildScripts} (release ${meta.release})`,
      `Cette copie n'est pas modifiée. Tu peux la remplacer par ton propre ffmpeg.exe dans les réglages de l'app.`,
      '',
    ].join('\n'),
  );
  fs.rmSync(tmp, { recursive: true, force: true });
}

(async () => {
  await download();
  extract();
  const files = fs.readdirSync(out);
  if (!files.includes('ffmpeg.exe')) throw new Error('ffmpeg.exe absent après extraction');
  console.log(`FFmpeg prêt dans ${path.relative(root, out)} (${files.length} fichiers)`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
