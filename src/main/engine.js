'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ENGINE_EXE = 'VE_CLI.exe';

// Visual Enhancer se télécharge à part ; on cherche son dossier (VE_CLI.exe à la racine).
function findEngine(dir) {
  if (!dir) return null;
  try {
    if (fs.existsSync(path.join(dir, ENGINE_EXE))) return dir;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const sub = path.join(dir, e.name);
      if (fs.existsSync(path.join(sub, ENGINE_EXE))) return sub;
    }
  } catch {
    /* dossier illisible */
  }
  return null;
}

function autodetect(roots) {
  for (const root of roots) {
    try {
      for (const e of fs.readdirSync(root, { withFileTypes: true })) {
        if (!e.isDirectory() || !/visual.?enhancer/i.test(e.name)) continue;
        const found = findEngine(path.join(root, e.name));
        if (found) return found;
      }
    } catch {
      /* racine absente */
    }
  }
  return null;
}

function killTree(child) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  } else {
    child.kill('SIGTERM');
  }
}

class Engine {
  // `prefixArgs` sert aux tests : exe = node, prefixArgs = [faux-cli.js].
  constructor({ exe, prefixArgs = [] }) {
    this.exe = exe;
    this.prefixArgs = prefixArgs;
  }

  devices(timeoutMs = 15000) {
    return new Promise((resolve) => {
      let out = '';
      const child = spawn(this.exe, [...this.prefixArgs, 'devices'], { windowsHide: true });
      const timer = setTimeout(() => killTree(child), timeoutMs);
      const grab = (d) => {
        if (out.length < 4000) out += d;
      };
      child.stdout.on('data', grab);
      child.stderr.on('data', grab);
      child.on('error', () => {
        clearTimeout(timer);
        resolve('');
      });
      child.on('close', () => {
        clearTimeout(timer);
        resolve(out.trim());
      });
    });
  }

  // Lance les jobs avec `concurrency` processus en parallèle. Retourne { done, cancel }.
  run(jobs, { concurrency = 1, onEvent = () => {} } = {}) {
    const running = new Map();
    let next = 0;
    let cancelled = false;

    const runOne = (job) =>
      new Promise((resolve) => {
        try {
          fs.mkdirSync(job.outDir, { recursive: true });
        } catch {
          /* la CLI créera ou signalera le dossier */
        }
        onEvent({ id: job.id, state: 'running', progress: null });
        const child = spawn(this.exe, [...this.prefixArgs, ...job.args], { windowsHide: true });
        running.set(job.id, child);
        let progress = null;
        let stdout = '';
        const tail = [];
        let partial = '';

        const onChunk = (data) => {
          partial += data.toString('utf8');
          const parts = partial.split(/[\r\n]+/);
          partial = parts.pop();
          for (const line of parts) {
            const text = line.trim();
            if (!text) continue;
            tail.push(text);
            if (tail.length > 6) tail.shift();
            const m = [...text.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*%/g)].pop();
            if (m) {
              const p = Math.min(100, Math.max(0, parseFloat(m[1].replace(',', '.'))));
              if (p !== progress) {
                progress = p;
                onEvent({ id: job.id, state: 'running', progress });
              }
            }
          }
        };

        child.stdout.on('data', (d) => {
          if (stdout.length < 100000) stdout += d.toString('utf8');
        });
        child.stderr.on('data', onChunk);
        child.on('error', (err) => {
          running.delete(job.id);
          onEvent({ id: job.id, state: 'error', message: err.message });
          resolve();
        });
        child.on('close', (code) => {
          running.delete(job.id);
          if (cancelled) {
            onEvent({ id: job.id, state: 'cancelled' });
          } else if (code === 0) {
            let result = null;
            try {
              result = JSON.parse(stdout);
            } catch {
              /* sortie non JSON : sans importance */
            }
            onEvent({ id: job.id, state: 'done', progress: 100, result });
          } else {
            onEvent({ id: job.id, state: 'error', message: tail.slice(-2).join(' · ') || `code ${code}` });
          }
          resolve();
        });
      });

    const worker = async () => {
      while (!cancelled && next < jobs.length) await runOne(jobs[next++]);
    };

    const done = Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker)).then(() => ({
      cancelled,
    }));

    const cancel = () => {
      if (cancelled) return;
      cancelled = true;
      for (let i = next; i < jobs.length; i++) onEvent({ id: jobs[i].id, state: 'cancelled' });
      for (const child of running.values()) killTree(child);
    };

    return { done, cancel };
  }
}

module.exports = { Engine, ENGINE_EXE, findEngine, autodetect };
