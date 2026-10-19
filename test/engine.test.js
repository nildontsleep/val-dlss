const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Engine, findEngine, autodetect } = require('../src/main/engine');
const { buildJobs } = require('../src/main/args');

const fake = path.join(__dirname, 'fake-cli.js');
const fakeFfmpeg = path.join(__dirname, 'fake-ffmpeg.js');
const engine = new Engine({ exe: process.execPath, prefixArgs: [fake], ffmpeg: process.execPath, ffmpegPrefix: [fakeFfmpeg] });

function collect(files, opts = {}) {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vdlss-'));
  const jobs = buildJobs({ files, options: { tiktok: false, ...opts.options }, outputDir });
  const events = [];
  const run = engine.run(jobs, { concurrency: opts.concurrency || 1, onEvent: (e) => events.push(e) });
  return { jobs, events, run, outputDir };
}

test('un job réussit, remonte sa progression et son résultat JSON', async () => {
  const { jobs, events, run } = collect(['a.mp4']);
  assert.deepEqual(await run.done, { cancelled: false });
  const mine = events.filter((e) => e.id === jobs[0].id);
  assert.ok(mine.some((e) => e.progress === 50));
  const last = mine.at(-1);
  assert.equal(last.state, 'done');
  assert.match(last.result.output, /a_Neural_Rendering\.mp4$/);
  assert.ok(fs.existsSync(last.result.output));
});

test('avec la méthode TikTok : finition ffmpeg, fichier final, aucun dossier caché', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vdlss-tk-'));
  const clip = path.join(dir, 'clip_120fps.mp4');
  fs.writeFileSync(clip, 'x');
  const outputDir = path.join(dir, 'out');
  const jobs = buildJobs({ files: [clip], options: {}, outputDir });
  const events = [];
  await engine.run(jobs, { onEvent: (e) => events.push(e) }).done;
  assert.ok(events.some((e) => e.phase === 'finish'));
  const last = events.at(-1);
  assert.equal(last.state, 'done');
  assert.equal(last.result.output, path.join(outputDir, 'clip_120fps_tiktok.mp4'));
  assert.deepEqual(fs.readdirSync(outputDir), ['clip_120fps_tiktok.mp4']);
});

test('un rendu en échec ne laisse pas de dossier caché', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vdlss-tk-'));
  const jobs = buildJobs({ files: ['fail.mp4'], options: {}, outputDir: dir });
  const events = [];
  await engine.run(jobs, { onEvent: (e) => events.push(e) }).done;
  assert.equal(events.at(-1).state, 'error');
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('un job en échec remonte le message de la CLI', async () => {
  const { jobs, events, run } = collect(['fail.mp4']);
  await run.done;
  const last = events.filter((e) => e.id === jobs[0].id).at(-1);
  assert.equal(last.state, 'error');
  assert.match(last.message, /illisible/);
});

test('le mode comparaison lance 3 jobs en parallèle', async () => {
  const { events, run } = collect(['clip.mp4'], { concurrency: 3, options: { compare: true } });
  await run.done;
  assert.equal(events.filter((e) => e.state === 'done').length, 3);
  const firstDone = events.findIndex((e) => e.state === 'done');
  assert.equal(events.slice(0, firstDone).filter((e) => e.state === 'running' && e.progress === null).length, 3);
});

test('annuler marque les jobs non lancés comme annulés', async () => {
  const { events, run } = collect(['a.mp4', 'b.mp4', 'c.mp4']);
  setTimeout(() => run.cancel(), 30);
  assert.deepEqual(await run.done, { cancelled: true });
  assert.ok(events.filter((e) => e.state === 'cancelled').length >= 2);
  assert.ok(!events.some((e) => e.state === 'error'));
});

test('findEngine et autodetect trouvent le dossier de Visual Enhancer', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vdlss-find-'));
  const ve = path.join(root, 'Visual.Enhancer.v16.0');
  fs.mkdirSync(path.join(ve, 'app'), { recursive: true });
  fs.writeFileSync(path.join(ve, 'VE_CLI.exe'), '');
  assert.equal(findEngine(ve), ve);
  assert.equal(findEngine(root), ve);
  assert.equal(autodetect([path.join(root, 'nope'), root]), ve);
  assert.equal(findEngine(path.join(root, 'nope')), null);
});
