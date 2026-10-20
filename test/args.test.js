const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildJobs, sanitizeOptions, sanitizePresets } = require('../src/main/args');

const out = path.join('out');

test('un clip -> un job h264/mp4, rendu dans un dossier caché avec la méthode TikTok', () => {
  const [job] = buildJobs({ files: ['a.mp4'], options: { style: 1, strength: 0.6 }, outputDir: out, idPrefix: 'x' });
  assert.equal(job.finalDir, out);
  assert.equal(job.outDir, path.join(out, '.vdlss-x-0'));
  assert.deepEqual(job.args, [
    'render', 'a.mp4', '--style', '1', '--strength', '0.60', '--quality', 'best',
    '--codec', 'h264', '--container', 'mp4', '--json', '-o', path.join(out, '.vdlss-x-0'),
  ]);
});

test('sans la méthode TikTok, le rendu va directement dans le dossier final', () => {
  const [job] = buildJobs({ files: ['a.mp4'], options: { tiktok: false }, outputDir: out });
  assert.equal(job.outDir, out);
  assert.equal(job.tiktok, false);
});

test('le mode comparaison crée un job par style dans des sous-dossiers', () => {
  const jobs = buildJobs({ files: ['clip.mp4'], options: { compare: true, tiktok: false }, outputDir: out });
  assert.deepEqual(jobs.map((j) => j.style), [0, 1, 2]);
  assert.deepEqual(jobs.map((j) => j.finalDir), [0, 1, 2].map((s) => path.join(out, 'clip', `style-${s}`)));
  assert.equal(new Set(jobs.map((j) => j.id)).size, 3);
});

test('les fichiers qui ne sont pas des vidéos sont ignorés', () => {
  assert.equal(buildJobs({ files: ['notes.txt', 'photo.png', 'a.mp4'], options: {}, outputDir: out }).length, 1);
});

test('le preset et la qualité choisie sont passés à la CLI', () => {
  const [job] = buildJobs({ files: ['a.mp4'], options: { quality: 'max', tiktok: false }, outputDir: out, presetPath: 'p.json' });
  assert.equal(job.args[job.args.indexOf('--quality') + 1], 'max');
  assert.deepEqual(job.args.slice(-2), ['--preset', 'p.json']);
});

test('les options sont bornées', () => {
  const o = sanitizeOptions({ style: 9, strength: 99, compare: 'oui', tiktok: false, tone: -3, skin: 7, passes: 99, autoMask: 'x', quality: 'rm -rf' });
  assert.deepEqual(o, { style: 2, strength: 2, compare: false, tiktok: false, tone: 0, structure: 1, skin: 1, passes: 3, autoMask: false, quality: 'best', maxSize: 0 });
  assert.deepEqual(sanitizeOptions(), { style: 2, strength: 1, compare: false, tiktok: true, tone: 1, structure: 1, skin: 1, passes: 1, autoMask: false, quality: 'best', maxSize: 0 });
});

test('les presets de l\'app sont nettoyés : noms, doublons, valeurs', () => {
  const list = sanitizePresets([
    { id: 'a', name: '  Moins clair  ', values: { tone: 0.5, passes: 99, tiktok: false } },
    { id: 'a', name: 'doublon', values: {} },
    { id: 'bad id!', name: 'x', values: {} },
    { id: 'b', name: '', values: {} },
    { id: 'c', name: 'x'.repeat(80), values: { quality: 'max' } },
  ]);
  assert.deepEqual(list.map((p) => p.id), ['a', 'c']);
  assert.equal(list[0].name, 'Moins clair');
  assert.equal(list[0].values.tone, 0.5);
  assert.equal(list[0].values.passes, 3);
  assert.ok(!('tiktok' in list[0].values));
  assert.ok(!('maxSize' in list[0].values));
  assert.equal(list[1].name.length, 40);
  assert.deepEqual(sanitizePresets('nope'), []);
});
