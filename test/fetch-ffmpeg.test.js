'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { expectedSum } = require('../scripts/fetch-ffmpeg');

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const text = `${A}  ffmpeg-master-latest-win64-gpl.zip\r\n${B} *ffmpeg-n8.1-latest-win64-lgpl-shared-8.1.zip\n\nnot a checksum line\n`;

test('expectedSum finds the asset in a checksums file (binary-mode star, CRLF)', () => {
  assert.equal(expectedSum(text, 'ffmpeg-n8.1-latest-win64-lgpl-shared-8.1.zip'), B);
  assert.equal(expectedSum(text, 'ffmpeg-master-latest-win64-gpl.zip'), A);
});

test('expectedSum returns null when the asset is absent or only partially matches a name', () => {
  assert.equal(expectedSum(text, 'ffmpeg-n9.0-latest-win64-lgpl-shared-9.0.zip'), null);
  assert.equal(expectedSum(text, 'win64-gpl.zip'), null);
  assert.equal(expectedSum('', 'x.zip'), null);
});
