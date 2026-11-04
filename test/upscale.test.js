'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { upscaleFile, validateUpscale, noteForUpscale } = require('../src/main/upscale');
const { Engine } = require('../src/main/engine');
const { buildJobs, sanitizeOptions } = require('../src/main/args');

const fake = path.join(__dirname, 'fake-cli.js');
const fakeFfmpeg = path.join(__dirname, 'fake-ffmpeg.js');
const ve = { exe: process.execPath, prefix: [fake] };
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const withEnv = async (env, fn) => {
  const old = {};
  for (const k of Object.keys(env)) {
    old[k] = process.env[k];
    process.env[k] = env[k];
  }
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(env)) {
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
    }
  }
};

test('upscale is sanitized: only x2 and x4, off by default', () => {
  assert.equal(sanitizeOptions({}).upscale, 0);
  assert.equal(sanitizeOptions({ upscale: 2 }).upscale, 2);
  assert.equal(sanitizeOptions({ upscale: '4' }).upscale, 4);
  for (const bad of [1, 3, 8, -2, 'x', null]) assert.equal(sanitizeOptions({ upscale: bad }).upscale, 0, String(bad));
  const [job] = buildJobs({ files: ['a.mp4'], options: { upscale: 4, tiktok: false }, outputDir: 'out' });
  assert.equal(job.upscale, 4);
});

test('validateUpscale: accepted, refused with the engine detail', async () => {
  const f = path.join(tmp('vdlss-up-'), 'a.mp4');
  fs.writeFileSync(f, 'x');
  assert.deepEqual(await validateUpscale({ ...ve, file: f, scale: 2 }), { ok: true });
  const r = await withEnv({ FAKE_UPSCALE_REFUSE: '1' }, () => validateUpscale({ ...ve, file: f, scale: 2 }));
  assert.deepEqual([r.ok, r.detail], [false, 'upscale not supported on this GPU']);
});

test('upscaleFile replaces the render with <name>_x2 and leaves no helper folder', async () => {
  const dir = tmp('vdlss-up-');
  const f = path.join(dir, 'clip_Neural_Rendering.mp4');
  fs.writeFileSync(f, 'render');
  const log = path.join(dir, 'log.jsonl');
  const r = await withEnv({ FAKE_UPSCALE_LOG: log }, () => upscaleFile({ ...ve, file: f, scale: 2 }));
  assert.equal(r.status, 'done');
  assert.equal(r.file, path.join(dir, 'clip_Neural_Rendering_x2.mp4'));
  assert.ok(fs.existsSync(r.file) && !fs.existsSync(f));
  assert.deepEqual(fs.readdirSync(dir).sort(), ['clip_Neural_Rendering_x2.mp4', 'log.jsonl']);
  const call = JSON.parse(fs.readFileSync(log, 'utf8'));
  assert.equal(call.scale, '2');
  assert.equal(call.out, path.join(dir, 'up')); // jamais le dossier du clip : VE ignore les clips de son dossier de sortie
});

test('upscaleFile keeps the render when the engine fails', async () => {
  const dir = tmp('vdlss-up-');
  const f = path.join(dir, 'clip.mp4');
  fs.writeFileSync(f, 'render');
  const r = await withEnv({ FAKE_UPSCALE_FAIL: '1' }, () => upscaleFile({ ...ve, file: f, scale: 4 }));
  assert.deepEqual([r.status, r.detail], ['failed', 'upscale crashed']);
  assert.deepEqual(fs.readdirSync(dir), ['clip.mp4']);
  assert.deepEqual(noteForUpscale(r), { code: 'upscale_failed', params: { detail: 'upscale crashed' } });
  assert.deepEqual(noteForUpscale({ status: 'done', scale: 2 }), { code: 'upscale_done', params: { scale: 2 } });
});

const engine = new Engine({ exe: process.execPath, prefixArgs: [fake], ffmpeg: process.execPath, ffmpegPrefix: [fakeFfmpeg] });
async function runJob(options, env = {}) {
  const dir = tmp('vdlss-upe-');
  const clip = path.join(dir, 'clip_120fps.mp4');
  fs.writeFileSync(clip, 'x');
  const outputDir = path.join(dir, 'out');
  const jobs = buildJobs({ files: [clip], options, outputDir });
  const events = [];
  await withEnv(env, () => engine.run(jobs, { onEvent: (e) => events.push(e) }).done);
  return { events, outputDir, last: events.at(-1) };
}

test('engine, without TikTok: upscaled file lands in the output folder, with the upscale phase and note', async () => {
  const { events, last, outputDir } = await runJob({ tiktok: false, upscale: 2 });
  assert.ok(events.some((e) => e.phase === 'upscale'));
  assert.equal(last.state, 'done');
  assert.equal(last.code, 'upscale_done');
  assert.equal(last.result.output, path.join(outputDir, 'clip_120fps_Neural_Rendering_x2.mp4'));
  assert.deepEqual(fs.readdirSync(outputDir), ['clip_120fps_Neural_Rendering_x2.mp4']);
});

test('engine, with TikTok: upscale first, then the TikTok step, no leftovers', async () => {
  const { events, last, outputDir } = await runJob({ tiktok: true, upscale: 4 });
  const phases = events.map((e) => e.phase).filter(Boolean);
  assert.deepEqual(phases.filter((p, i) => p !== phases[i - 1]), ['upscale', 'finish']);
  assert.equal(last.state, 'done');
  assert.deepEqual(fs.readdirSync(outputDir), ['clip_120fps_tiktok.mp4']);
});

test('engine: a failing upscale keeps the neural render and says so, instead of failing the clip', async () => {
  const { last, outputDir } = await runJob({ tiktok: false, upscale: 2 }, { FAKE_UPSCALE_FAIL: '1' });
  assert.equal(last.state, 'done');
  assert.equal(last.code, 'upscale_failed');
  assert.deepEqual(fs.readdirSync(outputDir), ['clip_120fps_Neural_Rendering.mp4']);
});

test('engine: a problem note (failed upscale) wins over the size-cap information', async () => {
  const { last } = await runJob({ tiktok: false, upscale: 2, maxSize: 98 }, { FAKE_UPSCALE_FAIL: '1', FAKE_OUT_BYTES: '101000000' });
  assert.equal(last.code, 'upscale_failed');
});

test('engine: no upscale, no phase, no note', async () => {
  const { events, last } = await runJob({ tiktok: false, upscale: 0 });
  assert.ok(!events.some((e) => e.phase));
  assert.equal(last.code, undefined);
});
