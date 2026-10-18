'use strict';
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { Store } = require('./store');
const { Engine, ENGINE_EXE, findEngine, autodetect } = require('./engine');
const { sanitizeOptions, buildJobs } = require('./args');
const { findFfmpegIn, findFfmpegOnPath, checkFfmpeg } = require('./tiktok');
const { VIDEO, isVideo } = require('./media');

const RELEASES_URL = 'https://github.com/Merserk/dlss5-visual-enhancer/releases';
const FFMPEG_URL = 'https://www.gyan.dev/ffmpeg/builds/';

let win = null;
let store = null;
let current = null; // run en cours : { cancel, done }

const defaultOutputDir = () => path.join(app.getPath('videos'), 'Valorant DLSS');

function createWindow() {
  win = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 880,
    minHeight: 620,
    backgroundColor: '#0b0c10',
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
    if (!s.ffmpegPath || !fs.existsSync(s.ffmpegPath)) {
      s = store.set({ ffmpegPath: findFfmpegIn(s.enginePath) || findFfmpegOnPath() || '' });
    }
    return { settings: s, defaultOutputDir: defaultOutputDir(), exts: VIDEO };
  });

  ipcMain.handle('settings:set', (_e, patch = {}) => {
    const o = sanitizeOptions({ ...store.get(), ...patch });
    const clean = {};
    for (const k of Object.keys(o)) if (k in patch) clean[k] = o[k];
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

  ipcMain.handle('ffmpeg:pick', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'ffmpeg.exe',
      properties: ['openFile'],
      filters: [{ name: 'ffmpeg', extensions: ['exe'] }],
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
    if (!(await checkFfmpeg(r.filePaths[0]))) return { ok: false, error: 'broken' };
    store.set({ ffmpegPath: r.filePaths[0] });
    return { ok: true, path: r.filePaths[0] };
  });

  ipcMain.handle('files:pick', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Choisir des clips',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Clips', extensions: VIDEO.map((e) => e.slice(1)) }],
    });
    return r.canceled ? [] : r.filePaths;
  });

  ipcMain.handle('output:pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Dossier de sortie', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false };
    store.set({ outputDir: r.filePaths[0] });
    return { ok: true, path: r.filePaths[0] };
  });

  ipcMain.handle('jobs:start', (_e, payload = {}) => {
    if (current) return { ok: false, error: 'busy' };
    const settings = store.get();
    const dir = findEngine(settings.enginePath);
    if (!dir) return { ok: false, error: 'engine' };
    const options = sanitizeOptions({ ...settings, ...payload.options });
    if (options.tiktok && !(settings.ffmpegPath && fs.existsSync(settings.ffmpegPath))) return { ok: false, error: 'ffmpeg' };
    const files = (Array.isArray(payload.files) ? payload.files : []).filter((f) => typeof f === 'string' && isVideo(f) && fs.existsSync(f));
    if (!files.length) return { ok: false, error: 'no-files' };

    const jobs = buildJobs({ files, options, outputDir: settings.outputDir || defaultOutputDir() });
    const engine = new Engine({ exe: path.join(dir, ENGINE_EXE), ffmpeg: settings.ffmpegPath });
    current = engine.run(jobs, { concurrency: options.compare ? 3 : 1, onEvent: (ev) => send('job:update', ev) });
    current.done.then((r) => {
      current = null;
      send('run:finished', r);
    });
    return { ok: true, compare: options.compare, jobs: jobs.map(({ id, name, style, finalDir }) => ({ id, name, style, outDir: finalDir })) };
  });

  ipcMain.handle('jobs:cancel', () => {
    if (current) current.cancel();
    return { ok: true };
  });

  ipcMain.handle('shell:openFolder', (_e, dir) => {
    if (typeof dir === 'string' && fs.existsSync(dir)) shell.openPath(dir);
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
