const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// i18n.js s'attache à window : on le charge dans un faux environnement.
global.window = {};
global.document = { documentElement: {}, querySelectorAll: () => [] };
require('../src/renderer/i18n.js');
const { DICT, t } = global.window.I18N;

test('anglais et français ont exactement les mêmes clés', () => {
  const en = Object.keys(DICT.en).sort();
  const fr = Object.keys(DICT.fr).sort();
  assert.deepEqual(fr.filter((k) => !en.includes(k)), [], 'clés FR sans équivalent EN');
  assert.deepEqual(en.filter((k) => !fr.includes(k)), [], 'clés EN sans équivalent FR');
});

test('chaque placeholder {x} est présent dans les deux langues', () => {
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const k of Object.keys(DICT.en)) assert.equal(ph(DICT.fr[k]), ph(DICT.en[k]), k);
});

test('t remplace les paramètres et retombe sur l\'anglais puis sur la clé', () => {
  global.window.I18N.lang = 'fr';
  assert.match(t('err.fps_unsupported', { fps: 144 }), /^144 fps : /);
  assert.equal(t('inconnue'), 'inconnue');
  global.window.I18N.lang = 'en';
  assert.match(t('err.fps_unsupported', { fps: 144 }), /^144 fps: /);
});

test('toutes les clés data-i18n* de index.html existent', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-html|-tip|-ph|-aria)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 20);
  for (const k of keys) assert.ok(k in DICT.en, `clé manquante : ${k}`);
});

test('les clés t(\'...\') utilisées dans app.js existent', () => {
  const js = fs.readFileSync(path.join(__dirname, '../src/renderer/app.js'), 'utf8');
  const keys = [...js.matchAll(/\bt\('([\w.]+)'/g)].map((m) => m[1]);
  for (const k of keys) assert.ok(k in DICT.en, `clé manquante : ${k}`);
});
