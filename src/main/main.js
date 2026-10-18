'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { Store } = require('./store');
const { Engine, ENGINE_EXE, findEngine, autodetect } = require('./engine');
const { sanitizeOptions, buildJobs } = require('./args');
const { discover, makePreset } = require('./preset');
const { VIDEO, IMAGE, kind } = require('./media');

const RELEASES_URL = 'https://github.com/Merserk/dlss5-visual-enhancer/releases';
const OPTION_KEYS = ['style', 'strength', 'compare', 'tone', 'structure', 'autoMask', 'quality', 'codec', 'container', 'parallel'];

let win = null;
let store = null;
let current = null; // { cancel, done } du run en cours

const dataFile = (name) => path.join(app.getPath('userData'), name);
const defaultOutputDir = () => path.join(app.getPath('videos'), 'Valorant DLSS');

function readTemplate(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function fineCounts() {
  const file = store.get().presetTemplate;
  const tpl = file && fs.existsSync(file) ? readTemplate(file) : null;
  return tpl ? discover(tpl) : null;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 880,
    minHeight: 620,
    backgroundColor: '#0d0e11',
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

function register() {
  ipcMain.handle('boot', () => {
    let s = store.get();
    if (!findEngine(s.enginePath)) {
      const roots = ['downloads', 'desktop', 'documents', 'home'].map((n) => app.getPath(n));
      s = store.set({ enginePath: autodetect(roots) || '' });
    }
    return {
      settings: s,
      defaultOutputDir: defaultOutputDir(),
      exts: { video: VIDEO, image: IMAGE },
      fine: fineCounts(),
      version: app.getVersion(),
    };
  });

  ipcMain.handle('settings:set', (_e, patch = {}) => {
    const clean = {};
    const options = sanitizeOptions({ ...store.get(), ...patch });
    for (const k of OPTION_KEYS) if (k in patch) clean[k] = options[k];
    if (typeof patch.outputDir === 'string' && patch.outputDir.length < 500) clean.outputDir = patch.outputDir;
    return store.set(clean);
  });

  ipcMain.handle('engine:pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Dossier de Visual Enhancer', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    const found = findEngine(r.filePaths[0]);
    if (!found) return { ok: false, error: 'missing' };
    store.set({ enginePath: found });
    return { ok: true, path: found };
  });

  ipcMain.handle('engine:devices', async () => {
    const dir = findEngine(store.get().enginePath);
    if (!dir) return '';
    return new Engine({ exe: path.join(dir, ENGINE_EXE) }).devices();
  });

  ipcMain.handle('files:pick', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Choisir des clips ou des images',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Médias', extensions: [...VIDEO, ...IMAGE].map((e) => e.slice(1)) }],
    });
    return r.canceled ? [] : r.filePaths;
  });

  ipcMain.handle('output:pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Dossier de sortie', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    store.set({ outputDir: r.filePaths[0] });
    return { ok: true, path: r.filePaths[0] };
  });

  ipcMain.handle('preset:import', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Preset exporté depuis Visual Enhancer',
      properties: ['openFile'],
      filters: [{ name: 'Preset JSON', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    const tpl = readTemplate(r.filePaths[0]);
    if (!tpl || typeof tpl !== 'object') return { ok: false, error: 'invalid' };
    const dest = dataFile('preset-template.json');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(tpl, null, 2));
    store.set({ presetTemplate: dest });
    return { ok: true, fine: discover(tpl) };
  });

  ipcMain.handle('preset:clear', () => {
    const file = store.get().presetTemplate;
    if (file) fs.rmSync(file, { force: true });
    store.set({ presetTemplate: '' });
    return { ok: true };
  });

  ipcMain.handle('jobs:start', (_e, payload = {}) => {
    if (current) return { ok: false, error: 'busy' };
    const settings = store.get();
    const dir = findEngine(settings.enginePath);
    if (!dir) return { ok: false, error: 'engine' };
    const files = (Array.isArray(payload.files) ? payload.files : []).filter(
      (f) => typeof f === 'string' && kind(f) && fs.existsSync(f),
    );
    if (!files.length) return { ok: false, error: 'no-files' };

    const options = sanitizeOptions({ ...settings, ...payload.options });
    const outputDir = settings.outputDir || defaultOutputDir();

    let presetPath = null;
    let fine = null;
    const tplFile = settings.presetTemplate;
    const tpl = tplFile && fs.existsSync(tplFile) ? readTemplate(tplFile) : null;
    if (tpl) {
      const made = makePreset(tpl, { tone: options.tone, structure: options.structure, autoMask: options.autoMask });
      presetPath = dataFile('run-preset.json');
      fs.writeFileSync(presetPath, JSON.stringify(made.preset, null, 2));
      fine = made.counts;
    }

    const jobs = buildJobs({ files, options, outputDir, presetPath });
    const engine = new Engine({ exe: path.join(dir, ENGINE_EXE) });
    const run = engine.run(jobs, { concurrency: options.parallel, onEvent: (ev) => send('job:update', ev) });
    current = run;
    run.done.then((r) => {
      current = null;
      send('run:finished', r);
    });
    return {
      ok: true,
      compare: options.compare,
      fine,
      jobs: jobs.map(({ id, name, style, outDir }) => ({ id, name, style, outDir })),
    };
  });

  ipcMain.handle('jobs:cancel', () => {
    if (current) current.cancel();
    return { ok: true };
  });

  ipcMain.handle('shell:openFolder', (_e, dir) => {
    if (typeof dir === 'string' && fs.existsSync(dir)) shell.openPath(dir);
  });
  ipcMain.handle('shell:releases', () => shell.openExternal(RELEASES_URL));
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
    store = new Store(dataFile('settings.json'), {
      enginePath: '',
      outputDir: '',
      presetTemplate: '',
      ...sanitizeOptions(),
    });
    register();
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (current) current.cancel();
    app.quit();
  });
}
