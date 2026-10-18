const test = require('node:test');
const assert = require('node:assert/strict');
const { discover, makePreset } = require('../src/main/preset');

const template = {
  video: {
    stages: [
      { id: 'neural', enabled: true, localToneStrength: 1, localStructureStrength: 1, skinStructureStrength: 1, automaticMask: true },
      { id: 'grain', enabled: false, strength: 0.3 },
    ],
  },
  image: { stages: [{ id: 'neural', local_tone: 1, auto_mask: false }] },
};

test('discover compte les clés reconnues, y compris dans les tableaux', () => {
  assert.deepEqual(discover(template), { tone: 2, structure: 1, autoMask: 2 });
});

test('makePreset modifie uniquement les bonnes clés et ne touche pas au modèle', () => {
  const { preset, counts } = makePreset(template, { tone: 0.4, structure: 0.2, autoMask: false });
  const n = preset.video.stages[0];
  assert.equal(n.localToneStrength, 0.4);
  assert.equal(n.localStructureStrength, 0.2);
  assert.equal(n.skinStructureStrength, 1);
  assert.equal(n.automaticMask, false);
  assert.equal(preset.video.stages[1].strength, 0.3);
  assert.deepEqual(counts, { tone: 2, structure: 1, autoMask: 2 });
  assert.equal(template.video.stages[0].localToneStrength, 1);
});

test('un preset sans clé reconnue donne zéro partout', () => {
  assert.deepEqual(discover({ a: { b: 1 } }), { tone: 0, structure: 0, autoMask: 0 });
});
