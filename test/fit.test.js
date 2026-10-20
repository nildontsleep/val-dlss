'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { planFit, fitFile, noteFor, parseAudioKbps, FLOOR_KBPS } = require('../src/main/fit');
const { Engine } = require('../src/main/engine');
const { buildJobs, sanitizeOptions } = require('../src/main/args');

const fake = path.join(__dirname, 'fake-cli.js');
const fakeFfmpeg = path.join(__dirname, 'fake-ffmpeg.js');
const tmpDir = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('the quality floor is 60 Mb/s', () => assert.equal(FLOOR_KBPS, 60000));

test('planFit: nothing to do when off, small enough or duration unknown', () => {
  const base = { sizeBytes: 50e6, durationSec: 10 };
  assert.equal(planFit({ ...base, maxMB: 0 }).action, 'keep');
  assert.equal(planFit({ ...base, maxMB: 50 }).action, 'keep');
  assert.equal(planFit({ ...base, maxMB: 10, durationSec: 0 }).action, 'keep');
});

test('planFit: re-encodes only when the needed bitrate stays above the floor', () => {
  // 100 Mo sur 10 s : 80 Mb/s au total, moins la marge et l'audio
  const ok = planFit({ sizeBytes: 300e6, durationSec: 10, maxMB: 100 });
  assert.equal(ok.action, 'reencode');
  assert.equal(ok.videoKbps, Math.floor((100e6 * 8 * 0.97) / 10 / 1000 - 192));
  assert.ok(ok.videoKbps >= FLOOR_KBPS);
  // 25 Mo sur 10 s : ~20 Mb/s, sous le plancher -> on garde le rendu
  const low = planFit({ sizeBytes: 300e6, durationSec: 10, maxMB: 25 });
  assert.equal(low.action, 'floor');
  assert.ok(low.neededKbps < FLOOR_KBPS);
});

test('planFit: the floor can be lowered for tests only', () => {
  assert.equal(planFit({ sizeBytes: 2e6, durationSec: 12.5, maxMB: 1, floorKbps: 100 }).action, 'reencode');
  assert.equal(planFit({ sizeBytes: 2e6, durationSec: 12.5, maxMB: 1, floorKbps: 1000 }).action, 'floor');
});

test('parseAudioKbps', () => {
  assert.equal(parseAudioKbps('  Stream #0:1: Audio: aac (LC), 48000 Hz, stereo, fltp, 160 kb/s'), 160);
  assert.equal(parseAudioKbps('  Stream #0:0: Video: h264, 1920x1080, 120 fps'), 192);
});

const bigFile = (name, bytes) => {
  const f = path.join(tmpDir('vdlss-fit-'), name);
  fs.writeFileSync(f, 'clip_120fps');
  fs.truncateSync(f, bytes);
  return f;
};
const ff = { ffmpeg: process.execPath, prefix: [fakeFfmpeg] };

test('fitFile: replaces the file in place when it fits above the floor', async () => {
  const f = bigFile('a.mp4', 2e6);
  const log = path.join(path.dirname(f), 'log.txt');
  process.env.FAKE_FFMPEG_LOG = log;
  try {
    const r = await fitFile({ ...ff, file: f, maxMB: 1, floorKbps: 100 });
    assert.equal(r.status, 'fitted');
    assert.ok(fs.statSync(f).size < 1e6);
    assert.deepEqual(fs.readdirSync(path.dirname(f)).sort(), ['a.mp4', 'log.txt']);
    const args = JSON.parse(fs.readFileSync(log, 'utf8').trim().split('\n').at(-1));
    assert.equal(args[args.indexOf('-c:v') + 1], 'h264_nvenc');
    assert.equal(args[args.indexOf('-c:a') + 1], 'copy');
    assert.equal(args[args.indexOf('-b:v') + 1], `${args[args.indexOf('-maxrate') + 1]}`);
  } finally {
    delete process.env.FAKE_FFMPEG_LOG;
  }
});

test('fitFile: keeps the render untouched below the floor, when small enough, or when the encoder fails', async () => {
  const f = bigFile('b.mp4', 2e6);
  assert.equal((await fitFile({ ...ff, file: f, maxMB: 1, floorKbps: 1000 })).status, 'floor');
  assert.equal(fs.statSync(f).size, 2e6);
  assert.equal((await fitFile({ ...ff, file: f, maxMB: 5 })).status, 'kept');

  process.env.FAKE_FFMPEG_FIT_FAIL = '1';
  try {
    const r = await fitFile({ ...ff, file: f, maxMB: 1, floorKbps: 100 });
    assert.deepEqual([r.status, r.detail], ['failed', 'Cannot load nvcuda.dll']);
    assert.equal(fs.statSync(f).size, 2e6);
    assert.deepEqual(fs.readdirSync(path.dirname(f)), ['b.mp4']);
  } finally {
    delete process.env.FAKE_FFMPEG_FIT_FAIL;
  }
});

test('fitFile: a result still over the limit is discarded', async () => {
  const f = bigFile('c.mp4', 2e6);
  process.env.FAKE_FFMPEG_FIT_BYTES = '1500000';
  try {
    const r = await fitFile({ ...ff, file: f, maxMB: 1, floorKbps: 100 });
    assert.deepEqual([r.status, r.detail], ['failed', 'over the limit']);
    assert.equal(fs.statSync(f).size, 2e6);
  } finally {
    delete process.env.FAKE_FFMPEG_FIT_BYTES;
  }
});

test('noteFor', () => {
  assert.equal(noteFor({ status: 'kept' }), null);
  assert.deepEqual(noteFor({ status: 'floor', neededMbps: 20 }), { code: 'fit_floor', params: { need: 20, floor: 60 } });
  assert.equal(noteFor({ status: 'fitted', mbps: 61, mb: 98 }).code, 'fit_done');
  assert.equal(noteFor({ status: 'failed', detail: 'x' }).code, 'fit_failed');
});

test('maxSize is sanitized and reaches the jobs', () => {
  assert.equal(sanitizeOptions({}).maxSize, 0);
  assert.equal(sanitizeOptions({ maxSize: '98.6' }).maxSize, 99);
  assert.equal(sanitizeOptions({ maxSize: -5 }).maxSize, 0);
  assert.equal(sanitizeOptions({ maxSize: 'abc' }).maxSize, 0);
  const jobs = buildJobs({ files: ['a.mp4'], options: { maxSize: 98, tiktok: false }, outputDir: 'out' });
  assert.equal(jobs[0].maxMB, 98);
});

const engine = new Engine({ exe: process.execPath, prefixArgs: [fake], ffmpeg: process.execPath, ffmpegPrefix: [fakeFfmpeg] });

async function runJob(options) {
  const dir = tmpDir('vdlss-eng-');
  const clip = path.join(dir, 'clip_120fps.mp4');
  fs.writeFileSync(clip, 'x');
  const outputDir = path.join(dir, 'out');
  const jobs = buildJobs({ files: [clip], options, outputDir });
  const events = [];
  process.env.FAKE_OUT_BYTES = '101000000'; // rendu creux de 101 Mo
  try {
    await engine.run(jobs, { onEvent: (e) => events.push(e) }).done;
  } finally {
    delete process.env.FAKE_OUT_BYTES;
  }
  return { events, outputDir, last: events.at(-1) };
}

test('engine, sans TikTok : plafond atteignable -> ré-encodé, note fit_done', async () => {
  const { events, last, outputDir } = await runJob({ tiktok: false, maxSize: 98 });
  assert.ok(events.some((e) => e.phase === 'fit'));
  assert.equal(last.state, 'done');
  assert.equal(last.code, 'fit_done');
  assert.ok(fs.statSync(last.result.output).size < 98e6);
  assert.deepEqual(fs.readdirSync(outputDir), ['clip_120fps_Neural_Rendering.mp4']);
});

test('engine, sans TikTok : plafond sous le plancher -> rendu conservé, note fit_floor', async () => {
  const { last } = await runJob({ tiktok: false, maxSize: 25 });
  assert.equal(last.state, 'done');
  assert.equal(last.code, 'fit_floor');
  assert.equal(last.params.floor, 60);
  assert.equal(fs.statSync(last.result.output).size, 101e6);
});

test('engine, avec TikTok : le plafond passe avant la finition, aucun fichier caché', async () => {
  const { events, last, outputDir } = await runJob({ tiktok: true, maxSize: 98 });
  const phases = events.map((e) => e.phase).filter(Boolean);
  assert.deepEqual(phases.filter((p, i) => p !== phases[i - 1]), ['fit', 'finish']);
  assert.equal(last.state, 'done');
  assert.equal(last.code, 'fit_done');
  assert.deepEqual(fs.readdirSync(outputDir), ['clip_120fps_tiktok.mp4']);
});

test('engine : sans plafond, aucune étape ni note', async () => {
  const { events, last } = await runJob({ tiktok: false, maxSize: 0 });
  assert.ok(!events.some((e) => e.phase === 'fit'));
  assert.equal(last.code, undefined);
});
