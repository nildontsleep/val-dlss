'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Réglages persistés dans un JSON local (userData). Aucune télémétrie, aucun réseau.
class Store {
  constructor(file, defaults) {
    this.file = file;
    this.defaults = defaults;
    this.data = { ...defaults };
    try {
      this.data = { ...defaults, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch {
      /* premier lancement ou fichier illisible : on repart des valeurs par défaut */
    }
  }

  get() {
    return { ...this.data };
  }

  set(patch) {
    this.data = { ...this.data, ...patch };
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch {
      /* échec d'écriture non bloquant */
    }
    return this.get();
  }
}

module.exports = { Store };
