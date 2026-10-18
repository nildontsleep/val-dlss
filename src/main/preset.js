'use strict';
// Les réglages fins (tonalité, détails, masque auto) ne sont pas des options de la CLI :
// ils passent par un preset JSON exporté depuis Visual Enhancer. Le schéma de ce preset
// n'est pas documenté, donc on retrouve les clés par leur nom et on dit combien on en a trouvées.

const KEYS = {
  tone: { re: /local.?tone/i, type: 'number' },
  structure: { re: /local.?struct/i, type: 'number' },
  autoMask: { re: /auto(matic)?.?mask/i, type: 'boolean' },
};

function walk(node, visit) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
  } else if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      visit(node, key);
      walk(node[key], visit);
    }
  }
}

const fits = (value, type) =>
  type === 'boolean' ? typeof value === 'boolean' || typeof value === 'number' : typeof value === 'number';

function discover(template) {
  const counts = { tone: 0, structure: 0, autoMask: 0 };
  walk(template, (node, key) => {
    for (const [name, spec] of Object.entries(KEYS)) {
      if (spec.re.test(key) && fits(node[key], spec.type)) counts[name]++;
    }
  });
  return counts;
}

function makePreset(template, values) {
  const preset = structuredClone(template);
  const counts = { tone: 0, structure: 0, autoMask: 0 };
  walk(preset, (node, key) => {
    for (const [name, spec] of Object.entries(KEYS)) {
      if (!spec.re.test(key) || !fits(node[key], spec.type) || values[name] === undefined) continue;
      const v = values[name];
      node[key] = typeof node[key] === 'number' && spec.type === 'boolean' ? (v ? 1 : 0) : v;
      counts[name]++;
    }
  });
  return { preset, counts };
}

module.exports = { discover, makePreset };
