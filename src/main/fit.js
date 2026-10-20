'use strict';
// Plafond de taille sans sacrifier la qualité : le rendu n'est ré-encodé (NVENC) que s'il dépasse le plafond
// ET si le débit nécessaire reste au-dessus du plancher (60 Mb/s). Sinon le rendu est conservé tel quel.
const fs = require('node:fs');
const path = require('node:path');
const { run, lastLine } = require('./tiktok');
const { parseDuration } = require('./preview');

const FLOOR_KBPS = 60000;
const MARGIN = 0.97; // marge pour le conteneur et les écarts du débit variable
const DEFAULT_AUDIO_KBPS = 192;

function parseAudioKbps(text) {
  const line = String(text).split(/\r?\n/).find((l) => /Stream #.*Audio:/.test(l));
  const m = line && line.match(/(\d+)\s*kb\/s/);
  return m ? Number(m[1]) : DEFAULT_AUDIO_KBPS;
}

// Décide quoi faire d'un rendu de `sizeBytes` pour un plafond de `maxMB` (Mo décimaux, comme Discord l'affiche).
function planFit({ sizeBytes, durationSec, maxMB, audioKbps = DEFAULT_AUDIO_KBPS, floorKbps = FLOOR_KBPS }) {
  const cap = maxMB * 1e6;
  if (!(cap > 0) || sizeBytes <= cap || !(durationSec > 0)) return { action: 'keep' };
  const videoKbps = Math.floor((cap * 8 * MARGIN) / durationSec / 1000 - audioKbps);
  if (videoKbps < floorKbps) return { action: 'floor', neededKbps: Math.max(1, videoKbps) };
  return { action: 'reencode', videoKbps };
}

// Applique le plafond à `file` (remplacé sur place si ré-encodé). Ne lève jamais : en cas de souci, le rendu reste intact.
async function fitFile({ ffmpeg, prefix = [], file, maxMB, track, isCancelled = () => false, floorKbps = FLOOR_KBPS }) {
  const probe = (await run(ffmpeg, [...prefix, '-hide_banner', '-i', file], track)).stderr;
  const durationSec = parseDuration(probe);
  const sizeBytes = fs.statSync(file).size;
  const plan = planFit({ sizeBytes, durationSec, maxMB, audioKbps: parseAudioKbps(probe), floorKbps });
  if (plan.action === 'keep') return { status: 'kept' };
  if (plan.action === 'floor') return { status: 'floor', neededMbps: Math.round(plan.neededKbps / 100) / 10 };
  if (isCancelled()) return { status: 'kept' };

  const k = plan.videoKbps;
  const tmp = path.join(path.dirname(file), `.vdlss-fit-${path.basename(file)}`);
  const r = await run(
    ffmpeg,
    [...prefix, '-hide_banner', '-loglevel', 'error', '-y', '-i', file,
      '-c:v', 'h264_nvenc', '-preset', 'p7', '-tune', 'hq', '-rc', 'vbr', '-b:v', `${k}k`, '-maxrate', `${k}k`, '-bufsize', `${2 * k}k`,
      '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', tmp],
    track,
  );
  const outSize = fs.existsSync(tmp) ? fs.statSync(tmp).size : 0;
  if (r.code !== 0 || !outSize || outSize > maxMB * 1e6) {
    fs.rmSync(tmp, { force: true });
    return { status: 'failed', detail: r.code !== 0 ? lastLine(r.stderr) : 'over the limit' };
  }
  fs.renameSync(tmp, file);
  return { status: 'fitted', mbps: Math.round(k / 1000), mb: Math.round(outSize / 1e5) / 10 };
}

// Message d'information pour la carte du clip (clés `err.*` côté interface).
function noteFor(res) {
  if (res.status === 'floor') return { code: 'fit_floor', params: { need: res.neededMbps, floor: FLOOR_KBPS / 1000 } };
  if (res.status === 'failed') return { code: 'fit_failed', params: { detail: res.detail } };
  if (res.status === 'fitted') return { code: 'fit_done', params: { mbps: res.mbps, mb: res.mb } };
  return null;
}

module.exports = { FLOOR_KBPS, planFit, fitFile, noteFor, parseAudioKbps };
