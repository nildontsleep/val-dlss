'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { bundledFfmpeg, pickFfmpeg } = require('../src/main/ffmpeg-path');

const never = () => {
  throw new Error('should not be called');
};

test('bundledFfmpeg: only when packaged and the file exists', () => {
  const exe = path.join('res', 'ffmpeg', 'ffmpeg.exe');
  assert.equal(bundledFfmpeg('res', true, (p) => p === exe), exe);
  assert.equal(bundledFfmpeg('res', false, () => true), '');
  assert.equal(bundledFfmpeg('res', true, () => false), '');
  assert.equal(bundledFfmpeg('', true, () => true), '');
});

test('pickFfmpeg: a saved path that still exists wins', () => {
  const r = pickFfmpeg({ saved: 'C:\\mine\\ffmpeg.exe', bundled: 'B', searchIn: never, onPath: never, exists: () => true });
  assert.equal(r, 'C:\\mine\\ffmpeg.exe');
});

test('pickFfmpeg: bundled copy beats the searches', () => {
  assert.equal(pickFfmpeg({ saved: '', bundled: 'B', searchIn: never, onPath: never, exists: () => false }), 'B');
  assert.equal(pickFfmpeg({ saved: 'gone', bundled: 'B', searchIn: never, onPath: never, exists: () => false }), 'B');
});

test('pickFfmpeg: falls back to the engine folder, then PATH, then empty', () => {
  const base = { saved: '', bundled: '', exists: () => false };
  assert.equal(pickFfmpeg({ ...base, searchIn: () => 'S', onPath: never }), 'S');
  assert.equal(pickFfmpeg({ ...base, searchIn: () => null, onPath: () => 'P' }), 'P');
  assert.equal(pickFfmpeg({ ...base, searchIn: () => null, onPath: () => null }), '');
});
