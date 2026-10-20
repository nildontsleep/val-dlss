'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Store } = require('./store');
const { Engine, ENGINE_EXE, findEngine, autodetect, killTree, validatePreset } = require('./engine');
const { sanitizeOptions, sanitizePresets, buildJobs, LANGS, STYLES } = require('./args');
const { findFfmpegIn, findFfmpegOnPath, checkFfmpeg } = require('./tiktok');
const { bundledFfmpeg, pickFfmpeg } = require('./ffmpeg-path');
const { needsPreset, buildPreset, SCHEMA_CANDIDATES } = require('./vepreset');
const { probeDuration, extractFrame, renderFrame, uniqueName, dataUrl } = require('./preview');
const { dialogText } = require('./strings');
const { VIDEO, isVideo } = require('./media');
const { checkForUpdate, downloadAsset, PAGE_PREFIX } = require('./updater');

const RELEASES_URL = 'https://github.com/Merserk/dlss5-visual-enhancer/releases';
const FFMPEG_URL = 'https://www.gyan.dev/ffmpeg/builds/';

let win = null;
let store = null;
let current = null; // run en cours : { cancel, done }
let starting = false;
let previewRun = null; // aperçu en cours : { cancelled, cancel }
let frameCache = null; // dernière frame extraite : { key, path }
let schemaVerified = false; // le schema_version du preset a déjà été accepté par ce Visual Enhancer
const openableDirs = new Set(); // dossiers de sortie que l'interface a le droit d'ouvrir
let pendingUpdate = null; // dernière mise à jour trouvée : { version, page, asset }
let updating = false;
// Version installée (NSIS) : l'installeur peut se remplacer ; la version portable renvoie vers la page de la release.
const isInstalled = () => app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE;

const defaultOutputDir = () => path.join(app.getPath('videos'), 'Valorant DLSS');
const previewDir = () => path.join(app.getPath('temp'), 'valorant-dlss');
const dlg = () => dialogText(store.get().lang);
const ffmpegReady = (s) => !!(s.ffmpegPath && fs.existsSync(s.ffmpegPath));

function createWindow() {
  win = new BrowserWindow({
    width: 1040,
    height: 740,
    minWidth: 900,
    minHeight: 660,
    backgroundColor: '#06070a',
    title: 'Valorant DLSS',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  if (process.env.VDLSS_DEBUG) win.webContents.openDevTools({ mode: 'detach' });
  win.on('closed', () => {
    win = null;
  });
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// Écrit le preset des réglages avancés. On essaie plusieurs `schema_version` et on garde la première
// que cette version de Visual Enhancer accepte (vérifié par --dry-run, sans rendu ni GPU).
async function preparePreset({ exe, file, options, target = path.join(app.getPath('userData'), 'run-preset.json') }) {
  const file_ = target;
  const preferred = store.get().presetSchema;
  let detail = '';
  for (const version of [...new Set([preferred, ...SCHEMA_CANDIDATES])]) {
    fs.writeFileSync(file_, JSON.stringify(buildPreset(options, version), null, 2));
    const r = await validatePreset({ exe, file, presetPath: file_, style: options.style, strength: options.strength });
    if (r.ok) {
      if (version !== preferred) store.set({ presetSchema: version });
      schemaVerified = true;
      return { ok: true, path: file_ };
    }
    detail = detail || r.detail;
  }
  return { ok: false, detail };
}

function register() {
  ipcMain.handle('boot', () => {
    let s = store.get();
    if (!findEngine(s.enginePath)) {
      const roots = ['downloads', 'desktop', 'documents', 'home'].map((n) => app.getPath(n));
      s = store.set({ enginePath: autodetect(roots) || '' });
    }
    if (!ffmpegReady(s)) {
      s = store.set({
        ffmpegPath: pickFfmpeg({
          saved: s.ffmpegPath,
          bundled: bundledFfmpeg(process.resourcesPath, app.isPackaged),
          searchIn: () => findFfmpegIn(s.enginePath),
          onPath: findFfmpegOnPath,
        }),
      });
    }
    return { settings: s, defaultOutputDir: defaultOutputDir(), exts: VIDEO };
  });

  ipcMain.handle('settings:set', (_e, patch = {}) => {
    const clean = {};
    const o = sanitizeOptions({ ...store.get(), ...patch });
    for (const k of Object.keys(o)) if (k in patch) clean[k] = o[k];
    if (LANGS.includes(patch.lang)) clean.lang = patch.lang;
    if (typeof patch.advancedOpen === 'boolean') clean.advancedOpen = patch.advancedOpen;
    if (typeof patch.checkUpdates === 'boolean') clean.checkUpdates = patch.checkUpdates;
    if ('presets' in patch) clean.presets = sanitizePresets(patch.presets);
    if (typeof patch.activePreset === 'string' && patch.activePreset.length <= 40) clean.activePreset = patch.activePreset;
    return store.set(clean);
  });

  ipcMain.handle('engine:pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: dlg().engine, properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    const found = findEngine(r.filePaths[0]);
    if (!found) return { ok: false, error: 'missing' };
    store.set({ enginePath: found });
    return { ok: true, path: found };
  });

  ipcMain.handle('ffmpeg:pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: dlg().ffmpeg, properties: ['openFile'], filters: [{ name: 'ffmpeg', extensions: ['exe'] }] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    if (!(await checkFfmpeg(r.filePaths[0]))) return { ok: false, error: 'broken' };
    store.set({ ffmpegPath: r.filePaths[0] });
    return { ok: true, path: r.filePaths[0] };
  });

  ipcMain.handle('files:pick', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: dlg().clips,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: dlg().clipsFilter, extensions: VIDEO.map((e) => e.slice(1)) }],
    });
    return r.canceled ? [] : r.filePaths;
  });

  ipcMain.handle('output:pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: dlg().out, properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    store.set({ outputDir: r.filePaths[0] });
    return { ok: true, path: r.filePaths[0] };
  });

  ipcMain.handle('clip:info', async (_e, file) => {
    const s = store.get();
    if (!ffmpegReady(s)) return { ok: false, error: 'ffmpeg' };
    if (typeof file !== 'string' || !isVideo(file) || !fs.existsSync(file)) return { ok: false, error: 'no-files' };
    const duration = await probeDuration({ ffmpeg: s.ffmpegPath, file });
    return duration ? { ok: true, duration } : { ok: false, error: 'extract' };
  });

  ipcMain.handle('preview:run', async (_e, req = {}) => {
    if (current || starting) return { ok: false, error: 'busy' };
    const s = store.get();
    const dir = findEngine(s.enginePath);
    if (!dir) return { ok: false, error: 'engine' };
    if (!ffmpegReady(s)) return { ok: false, error: 'ffmpeg' };
    const file = req.file;
    if (typeof file !== 'string' || !isVideo(file) || !fs.existsSync(file)) return { ok: false, error: 'no-files' };

    if (previewRun) previewRun.cancel();
    const children = new Set();
    const token = {
      cancelled: false,
      cancel() {
        this.cancelled = true;
        for (const c of children) killTree(c);
      },
    };
    previewRun = token;
    const track = (c) => children.add(c);
    let result = null;
    try {
      const options = sanitizeOptions({ ...s, ...req.options });
      const time = Math.min(1e6, Math.max(0, Number(req.time) || 0));
      const tmp = previewDir();
      fs.mkdirSync(tmp, { recursive: true });

      const key = `${file}|${time}`;
      if (!frameCache || frameCache.key !== key || !fs.existsSync(frameCache.path)) {
        const out = uniqueName(tmp, 'frame', '.png');
        const ok = await extractFrame({ ffmpeg: s.ffmpegPath, file, time, out, track });
        if (token.cancelled) return { ok: false, cancelled: true };
        if (!ok) return { ok: false, error: 'extract' };
        if (frameCache) fs.rmSync(frameCache.path, { force: true });
        frameCache = { key, path: out };
      }

      let presetPath = null;
      if (needsPreset(options)) {
        presetPath = path.join(tmp, 'preview-preset.json');
        if (schemaVerified) {
          fs.writeFileSync(presetPath, JSON.stringify(buildPreset(options, store.get().presetSchema)));
        } else {
          const prep = await preparePreset({ exe: path.join(dir, ENGINE_EXE), file: frameCache.path, options, target: presetPath });
          if (token.cancelled) return { ok: false, cancelled: true };
          if (!prep.ok) return { ok: false, error: 'preset', detail: prep.detail };
        }
      }
      const renderStyle = async (style) => {
        const out = uniqueName(tmp, 'result', '.png');
        const r = await renderFrame({ exe: path.join(dir, ENGINE_EXE), input: frameCache.path, out, style, strength: options.strength, presetPath, track });
        const after = r.ok && !token.cancelled ? dataUrl(out) : null;
        fs.rmSync(out, { force: true });
        return { r, after };
      };

      if (req.grid === true) {
        // Les trois styles de la même frame, l'un après l'autre : chaque tuile part dès qu'elle est prête.
        let okCount = 0;
        let detail = '';
        for (const style of STYLES) {
          const { r, after } = await renderStyle(style);
          if (token.cancelled) return { ok: false, cancelled: true };
          if (r.ok) okCount++;
          else detail = detail || r.detail;
          send('preview:tile', { id: req.id, style, after, detail: r.ok ? '' : r.detail });
        }
        if (!okCount) return { ok: false, error: 'render', detail };
        return { ok: true, grid: true, before: dataUrl(frameCache.path) };
      }

      const { r, after } = await renderStyle(options.style);
      if (token.cancelled) return { ok: false, cancelled: true };
      if (!r.ok) return { ok: false, error: 'render', detail: r.detail };
      result = { ok: true, before: dataUrl(frameCache.path), after };
      return result;
    } finally {
      if (previewRun === token) previewRun = null;
    }
  });

  ipcMain.handle('jobs:start', async (_e, payload = {}) => {
    if (current || starting) return { ok: false, error: 'busy' };
    starting = true;
    try {
      const settings = store.get();
      const dir = findEngine(settings.enginePath);
      if (!dir) return { ok: false, error: 'engine' };
      const options = sanitizeOptions({ ...settings, ...payload.options });
      if ((options.tiktok || options.maxSize) && !ffmpegReady(settings)) return { ok: false, error: 'ffmpeg' };
      const files = (Array.isArray(payload.files) ? payload.files : []).filter((f) => typeof f === 'string' && isVideo(f) && fs.existsSync(f));
      if (!files.length) return { ok: false, error: 'no-files' };
      if (previewRun) previewRun.cancel();

      const exe = path.join(dir, ENGINE_EXE);
      let presetPath = null;
      if (needsPreset(options)) {
        const prep = await preparePreset({ exe, file: files[0], options });
        if (!prep.ok) return { ok: false, error: 'preset', detail: prep.detail };
        presetPath = prep.path;
      }

      const jobs = buildJobs({ files, options, outputDir: settings.outputDir || defaultOutputDir(), presetPath });
      for (const j of jobs) openableDirs.add(path.resolve(j.finalDir));
      const engine = new Engine({ exe, ffmpeg: settings.ffmpegPath });
      current = engine.run(jobs, { concurrency: options.compare ? 3 : 1, onEvent: (ev) => send('job:update', ev) });
      current.done.then((r) => {
        current = null;
        send('run:finished', r);
      });
      return { ok: true, compare: options.compare, jobs: jobs.map(({ id, name, style, finalDir }) => ({ id, name, style, outDir: finalDir })) };
    } finally {
      starting = false;
    }
  });

  ipcMain.handle('jobs:cancel', () => {
    if (current) current.cancel();
    return { ok: true };
  });

  // Seuls les dossiers de sortie créés par un rendu peuvent être ouverts : l'interface ne choisit pas un chemin libre.
  ipcMain.handle('shell:openFolder', (_e, dir) => {
    if (typeof dir !== 'string') return;
    const resolved = path.resolve(dir);
    if (openableDirs.has(resolved) && fs.existsSync(resolved)) shell.openPath(resolved);
  });
  // Une seule requête au lancement, désactivable dans « À propos ». Jamais en développement.
  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged || !store.get().checkUpdates) return { ok: true, update: null };
    const r = await checkForUpdate({ current: app.getVersion(), installed: isInstalled() });
    pendingUpdate = r.ok ? r.update : null;
    return r.ok
      ? { ok: true, update: pendingUpdate && { version: pendingUpdate.version, direct: isInstalled() && !!pendingUpdate.asset } }
      : { ok: false };
  });

  // L'interface ne fournit aucune URL : on n'utilise que la mise à jour trouvée par `update:check`.
  ipcMain.handle('update:install', async () => {
    if (!pendingUpdate || updating) return { ok: false, error: 'none' };
    if (!isInstalled() || !pendingUpdate.asset) {
      if (pendingUpdate.page.startsWith(PAGE_PREFIX)) shell.openExternal(pendingUpdate.page);
      return { ok: true, opened: true };
    }
    if (current || starting) return { ok: false, error: 'busy' };
    updating = true;
    try {
      const dir = path.join(app.getPath('temp'), 'valorant-dlss-update');
      const r = await downloadAsset({ asset: pendingUpdate.asset, dir, onProgress: (p) => send('update:progress', p) });
      if (!r.ok) return { ok: false, error: r.error };
      if (current || starting) return { ok: false, error: 'busy' };
      spawn(r.path, [], { detached: true, stdio: 'ignore' }).unref();
      app.quit();
      return { ok: true };
    } finally {
      updating = false;
    }
  });

  ipcMain.handle('shell:link', (_e, which) => shell.openExternal(which === 'ffmpeg' ? FFMPEG_URL : RELEASES_URL));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    Menu.setApplicationMenu(null);
    store = new Store(path.join(app.getPath('userData'), 'settings.json'), {
      enginePath: '',
      ffmpegPath: '',
      outputDir: '',
      lang: 'en',
      advancedOpen: false,
      checkUpdates: true,
      presets: [],
      activePreset: 'default',
      presetSchema: SCHEMA_CANDIDATES[0],
      ...sanitizeOptions(),
    });
    fs.rmSync(previewDir(), { recursive: true, force: true });
    register();
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (current) current.cancel();
    if (previewRun) previewRun.cancel();
    fs.rmSync(previewDir(), { recursive: true, force: true });
    app.quit();
  });
}
