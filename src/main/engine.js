'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { finish, run: runCapture, lastLine } = require('./tiktok');
const { fitFile, noteFor } = require('./fit');

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

// Dossier de travail caché du rendu : supprimé quand le rendu échoue ou est annulé.
function dropWork(job) {
  if (path.basename(job.outDir).startsWith('.vdlss-')) fs.rmSync(job.outDir, { recursive: true, force: true });
}

function killTree(child) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  } else {
    child.kill('SIGTERM');
  }
}

class Engine {
  // `prefixArgs` / `ffmpegPrefix` servent aux tests : exe = node, prefixArgs = [faux-cli.js].
  constructor({ exe, prefixArgs = [], ffmpeg = '', ffmpegPrefix = [] }) {
    this.exe = exe;
    this.prefixArgs = prefixArgs;
    this.ffmpeg = ffmpeg;
    this.ffmpegPrefix = ffmpegPrefix;
  }

  // Lance les jobs avec `concurrency` processus en parallèle. Retourne { done, cancel }.
  run(jobs, { concurrency = 1, onEvent = () => {} } = {}) {
    const running = new Map();
    let next = 0;
    let cancelled = false;

    const runOne = (job) =>
      new Promise((resolve) => {
        const fit = async (file) =>
          fitFile({
            ffmpeg: this.ffmpeg,
            prefix: this.ffmpegPrefix,
            file,
            maxMB: job.maxMB,
            track: (c) => running.set(`${job.id}:post`, c),
            isCancelled: () => cancelled,
          });
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
          dropWork(job);
          onEvent({ id: job.id, state: 'error', message: err.message });
          resolve();
        });
        child.on('close', async (code) => {
          running.delete(job.id);
          if (cancelled) {
            dropWork(job);
            onEvent({ id: job.id, state: 'cancelled' });
          } else if (code !== 0) {
            dropWork(job);
            let reason = '';
            try {
              reason = JSON.parse(stdout).items?.[0]?.error || '';
            } catch {
              /* pas de JSON : on garde la fin de stderr */
            }
            onEvent({ id: job.id, state: 'error', message: reason || tail.slice(-2).join(' · ') || `code ${code}` });
          } else {
            const firstPhase = job.maxMB ? 'fit' : job.tiktok ? 'finish' : null;
            if (firstPhase) onEvent({ id: job.id, state: 'running', phase: firstPhase, progress: null });
            const res = await finish({
              method: job.tiktok,
              ffmpeg: this.ffmpeg,
              prefix: this.ffmpegPrefix,
              workDir: job.outDir,
              finalDir: job.finalDir,
              stem: job.stem,
              track: (c) => running.set(`${job.id}:post`, c),
              isCancelled: () => cancelled,
              fit: job.maxMB ? async (f) => noteFor(await fit(f)) : null,
              onPhase: (phase) => onEvent({ id: job.id, state: 'running', phase, progress: null }),
            });
            running.delete(`${job.id}:post`);
            if (res.cancelled || cancelled) onEvent({ id: job.id, state: 'cancelled' });
            else if (res.ok) onEvent({ id: job.id, state: 'done', progress: 100, result: { output: res.output }, ...(res.note || {}) });
            else onEvent({ id: job.id, state: 'error', code: res.code, params: res.params });
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

// Valide un preset sans rien rendre : `--dry-run --json` lit le preset et décrit le pipeline.
async function validatePreset({ exe, prefix = [], file, presetPath, style, strength }) {
  const args = [...prefix, 'render', file, '--preset', presetPath, '--style', String(style), '--strength', strength.toFixed(2), '--dry-run', '--json'];
  const r = await runCapture(exe, args);
  let plan = null;
  try {
    plan = JSON.parse(r.stdout);
  } catch {
    /* sortie non JSON */
  }
  if (plan && plan.ok === true) {
    const stages = plan.items?.[0]?.stages;
    if (stages !== undefined && !/neural/i.test(JSON.stringify(stages))) return { ok: false, detail: 'neural stage not enabled' };
    return { ok: true };
  }
  return { ok: false, detail: (plan && plan.error) || lastLine(r.stderr) || `code ${r.code}` };
}

module.exports = { Engine, ENGINE_EXE, findEngine, autodetect, killTree, validatePreset };
