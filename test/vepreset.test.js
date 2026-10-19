const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { needsPreset, buildPreset, FORMAT } = require('../src/main/vepreset');
const { validatePreset } = require('../src/main/engine');
const { sanitizeOptions } = require('../src/main/args');

const fake = path.join(__dirname, 'fake-cli.js');

test('needsPreset : seulement si un réglage avancé s\'écarte des valeurs par défaut', () => {
  assert.equal(needsPreset(sanitizeOptions()), false);
  assert.equal(needsPreset(sanitizeOptions({ tone: 0.5 })), true);
  assert.equal(needsPreset(sanitizeOptions({ autoMask: true })), true);
  assert.equal(needsPreset(sanitizeOptions({ quality: 'max', style: 0 })), false);
});

test('buildPreset suit le format de Visual Enhancer et active l\'étape neurale', () => {
  const p = buildPreset(sanitizeOptions({ tone: 0.4, structure: 0.3, skin: 0.8, passes: 2, autoMask: true }), 36);
  assert.equal(p.format, FORMAT);
  assert.equal(p.schema_version, 36);
  assert.deepEqual(p.settings, {
    local_tone_strength: 0.4, local_structure_strength: 0.3, skin_structure_strength: 0.8, nr_passes: 2, automatic_mask: true,
    image_enabled_stages: ['neural_model'], video_enabled_stages: ['neural_model'],
  });
});

async function check(version, maxSchema) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vdlss-pre-'));
  const presetPath = path.join(dir, 'p.json');
  fs.writeFileSync(presetPath, JSON.stringify(buildPreset(sanitizeOptions({ tone: 0.5 }), version)));
  process.env.FAKE_MAX_SCHEMA = String(maxSchema);
  try {
    return await validatePreset({ exe: process.execPath, prefix: [fake], file: 'clip.mp4', presetPath, style: 2, strength: 1 });
  } finally {
    delete process.env.FAKE_MAX_SCHEMA;
  }
}

test('validatePreset accepte un preset valide (dry-run)', async () => {
  assert.deepEqual(await check(38, 38), { ok: true });
});

test('validatePreset remonte le refus de la CLI', async () => {
  const r = await check(38, 36);
  assert.equal(r.ok, false);
  assert.match(r.detail, /schema_version 38/);
});
