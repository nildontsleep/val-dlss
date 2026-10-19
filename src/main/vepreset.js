'use strict';
// Preset JSON de Visual Enhancer. Format lu dans son code (Settings::importPreset) :
//   { format, schema_version (1..38), name, settings: { <champ>: <valeur> } }
// Les clés absentes gardent leur valeur courante ; les clés inconnues sont ignorées.
const FORMAT = 'dlss5-visual-enhancer-settings-preset';
const SCHEMA_CANDIDATES = [38, 37, 36, 35];
const ADVANCED_DEFAULTS = { tone: 1, structure: 1, skin: 1, passes: 1, autoMask: false };

// Un preset n'est écrit que si un réglage avancé s'écarte des valeurs par défaut de Visual Enhancer.
const needsPreset = (o) => Object.keys(ADVANCED_DEFAULTS).some((k) => o[k] !== ADVANCED_DEFAULTS[k]);

function buildPreset(o, schemaVersion = SCHEMA_CANDIDATES[0]) {
  return {
    format: FORMAT,
    schema_version: schemaVersion,
    name: 'Valorant DLSS',
    settings: {
      local_tone_strength: o.tone,
      local_structure_strength: o.structure,
      skin_structure_strength: o.skin,
      nr_passes: o.passes,
      automatic_mask: o.autoMask,
      // Sans ces deux listes, --style et --strength échouent si l'étape neurale est désactivée.
      image_enabled_stages: ['neural_model'],
      video_enabled_stages: ['neural_model'],
    },
  };
}

module.exports = { FORMAT, SCHEMA_CANDIDATES, ADVANCED_DEFAULTS, needsPreset, buildPreset };
