const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildJobs, sanitizeOptions } = require('../src/main/args');

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

test('les options sont bornées', () => {
  assert.deepEqual(sanitizeOptions({ style: 9, strength: 99, compare: 'oui', tiktok: false }), { style: 2, strength: 2, compare: false, tiktok: false });
  assert.deepEqual(sanitizeOptions(), { style: 2, strength: 1, compare: false, tiktok: true });
});
