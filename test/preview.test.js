const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseDuration, probeDuration, extractFrame, renderFrame, uniqueName } = require('../src/main/preview');

const ffmpegPrefix = [path.join(__dirname, 'fake-ffmpeg.js')];
const cliPrefix = [path.join(__dirname, 'fake-cli.js')];
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vdlss-prev-'));

test('parseDuration lit la durée de ffmpeg', () => {
  assert.equal(parseDuration('  Duration: 00:01:02.50, start: 0'), 62.5);
  assert.equal(parseDuration('Duration: 01:00:00.00'), 3600);
  assert.equal(parseDuration('rien'), null);
});

test('probeDuration et extractFrame passent par ffmpeg', async () => {
  const dir = tmp();
  const clip = path.join(dir, 'clip_120fps.mp4');
  fs.writeFileSync(clip, 'x');
  assert.equal(await probeDuration({ ffmpeg: process.execPath, prefix: ffmpegPrefix, file: clip }), 12.5);
  const out = path.join(dir, 'frame.png');
  assert.equal(await extractFrame({ ffmpeg: process.execPath, prefix: ffmpegPrefix, file: clip, time: 4.2, out }), true);
  assert.equal(fs.readFileSync(out, 'utf8'), 'frame@4.2');
});

test('extractFrame renvoie false quand ffmpeg échoue', async () => {
  process.env.FAKE_FFMPEG_NOFRAME = '1';
  const dir = tmp();
  const ok = await extractFrame({ ffmpeg: process.execPath, prefix: ffmpegPrefix, file: 'x.mp4', time: 0, out: path.join(dir, 'f.png') });
  delete process.env.FAKE_FFMPEG_NOFRAME;
  assert.equal(ok, false);
});

test('renderFrame rend une image PNG et refuse d\'écraser un fichier', async () => {
  const dir = tmp();
  const input = path.join(dir, 'frame.png');
  fs.writeFileSync(input, 'frame');
  const out = uniqueName(dir, 'result', '.png');
  assert.deepEqual(await renderFrame({ exe: process.execPath, prefix: cliPrefix, input, out, style: 1, strength: 0.8 }), { ok: true });
  assert.equal(fs.readFileSync(out, 'utf8'), 'png-result');
  assert.notEqual(uniqueName(dir, 'result', '.png'), uniqueName(dir, 'result', '.png'));
  const again = await renderFrame({ exe: process.execPath, prefix: cliPrefix, input, out, style: 1, strength: 0.8 });
  assert.equal(again.ok, false);
  assert.match(again.detail, /existe déjà/);
});
