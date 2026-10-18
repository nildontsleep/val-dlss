const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { buildJobs, sanitizeOptions } = require('../src/main/args');

const out = path.join('out');

test('un clip vidéo -> un job avec codec et conteneur', () => {
  const [job] = buildJobs({ files: ['a.mp4'], options: { style: 1, strength: 0.6 }, outputDir: out });
  assert.deepEqual(job.args, [
    'render', 'a.mp4', '--style', '1', '--strength', '0.60', '--quality', 'good',
    '--codec', 'h264', '--container', 'mp4', '--json', '-o', out,
  ]);
});

test('une image ne reçoit ni codec ni conteneur', () => {
  const [job] = buildJobs({ files: ['a.png'], options: {}, outputDir: out });
  assert.ok(!job.args.includes('--codec'));
  assert.ok(!job.args.includes('--container'));
});

test('le mode comparaison crée un job par style dans des sous-dossiers', () => {
  const jobs = buildJobs({ files: ['clip.mp4'], options: { compare: true }, outputDir: out });
  assert.deepEqual(jobs.map((j) => j.style), [0, 1, 2]);
  assert.deepEqual(jobs.map((j) => j.outDir), [0, 1, 2].map((s) => path.join(out, 'clip', `style-${s}`)));
  assert.equal(new Set(jobs.map((j) => j.id)).size, 3);
});

test('le preset est passé à la CLI quand il existe', () => {
  const [job] = buildJobs({ files: ['a.mp4'], options: {}, outputDir: out, presetPath: 'p.json' });
  assert.deepEqual(job.args.slice(-2), ['--preset', 'p.json']);
});

test('les fichiers non pris en charge sont ignorés', () => {
  assert.equal(buildJobs({ files: ['notes.txt', 'a.mp4'], options: {}, outputDir: out }).length, 1);
});

test('les options sont bornées', () => {
  const o = sanitizeOptions({ style: 9, strength: 99, tone: -3, codec: 'x; rm', parallel: 50, autoMask: 'non' });
  assert.equal(o.style, 2);
  assert.equal(o.strength, 2);
  assert.equal(o.tone, 0);
  assert.equal(o.codec, 'h264');
  assert.equal(o.parallel, 3);
  assert.equal(o.autoMask, true);
});
