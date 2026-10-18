const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseFps, scaleFor, finish, findFfmpegIn, checkFfmpeg } = require('../src/main/tiktok');

const fake = path.join(__dirname, 'fake-ffmpeg.js');
const prefix = [fake];

test('parseFps lit les fps (ou le tbr) de la ligne vidéo', () => {
  assert.equal(parseFps('  Stream #0:0: Video: h264, 1920x1080, 119.88 fps, 120 tbr'), 119.88);
  assert.equal(parseFps('  Stream #0:0: Video: h264, 1920x1080, 60 tbr, 90k tbn'), 60);
  assert.equal(parseFps('  Stream #0:1: Audio: aac, 48000 Hz'), null);
});

test('scaleFor suit la table du script d\'origine : 60 -> 2, 120 -> 6, 240 -> 12', () => {
  assert.equal(scaleFor(60), 2);
  assert.equal(scaleFor(59.94), 2);
  assert.equal(scaleFor(119.88), 6);
  assert.equal(scaleFor(240), 12);
  assert.equal(scaleFor(144), null);
  assert.equal(scaleFor(null), null);
});

function setup(content) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vdlss-tk-'));
  const workDir = path.join(root, '.vdlss-1');
  fs.mkdirSync(workDir);
  fs.writeFileSync(path.join(workDir, 'clip_Neural_Rendering.mp4'), content);
  return { root, workDir, log: path.join(root, 'ffmpeg.log') };
}

test('finish remuxe avec -itsscale et copie des flux, puis nettoie le dossier caché', async () => {
  const { root, workDir, log } = setup('clip_120fps');
  process.env.FAKE_FFMPEG_LOG = log;
  const res = await finish({ ffmpeg: process.execPath, prefix, workDir, finalDir: root, stem: 'clip' });
  delete process.env.FAKE_FFMPEG_LOG;
  assert.equal(res.ok, true);
  assert.equal(res.scale, 6);
  assert.equal(res.output, path.join(root, 'clip_tiktok.mp4'));
  assert.ok(fs.existsSync(res.output));
  assert.ok(!fs.existsSync(workDir));
  const args = JSON.parse(fs.readFileSync(log, 'utf8').trim());
  assert.deepEqual(args.slice(args.indexOf('-y'), args.indexOf('-i')), ['-y', '-itsscale', '6']);
  assert.deepEqual(args.slice(args.indexOf('-c:v')), ['-c:v', 'copy', '-c:a', 'copy', res.output]);
});

test('finish ne remplace jamais un fichier existant', async () => {
  const { root, workDir } = setup('clip_60fps');
  fs.writeFileSync(path.join(root, 'clip_tiktok.mp4'), 'ancien');
  const res = await finish({ ffmpeg: process.execPath, prefix, workDir, finalDir: root, stem: 'clip' });
  assert.equal(res.output, path.join(root, 'clip_tiktok (2).mp4'));
  assert.equal(fs.readFileSync(path.join(root, 'clip_tiktok.mp4'), 'utf8'), 'ancien');
});

test('fps non géré : le rendu est conservé tel quel', async () => {
  const { root, workDir } = setup('clip_144fps');
  const res = await finish({ ffmpeg: process.execPath, prefix, workDir, finalDir: root, stem: 'clip' });
  assert.equal(res.ok, false);
  assert.match(res.error, /60, 120 ou 240/);
  assert.equal(res.output, path.join(root, 'clip_Neural_Rendering.mp4'));
  assert.ok(fs.existsSync(res.output));
  assert.ok(!fs.existsSync(workDir));
});

test('échec de ffmpeg : message remonté et rendu conservé', async () => {
  const { root, workDir } = setup('clip_120fps');
  process.env.FAKE_FFMPEG_FAIL = '1';
  const res = await finish({ ffmpeg: process.execPath, prefix, workDir, finalDir: root, stem: 'clip' });
  delete process.env.FAKE_FFMPEG_FAIL;
  assert.equal(res.ok, false);
  assert.match(res.error, /pas assez de place/);
  assert.ok(fs.existsSync(path.join(root, 'clip_Neural_Rendering.mp4')));
  assert.ok(!fs.existsSync(path.join(root, 'clip_tiktok.mp4')));
});

test('findFfmpegIn cherche dans les sous-dossiers, checkFfmpeg lance -version', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vdlss-ff-'));
  const deep = path.join(root, 'app', 'bin', 'runtime');
  fs.mkdirSync(deep, { recursive: true });
  const exe = path.join(deep, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  fs.writeFileSync(exe, '');
  assert.equal(findFfmpegIn(root), exe);
  assert.equal(findFfmpegIn(path.join(root, 'nope')), null);
  assert.equal(await checkFfmpeg(process.execPath, [fake]), true);
});
