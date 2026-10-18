'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const invoke = (channel) => (arg) => ipcRenderer.invoke(channel, arg);

contextBridge.exposeInMainWorld('api', {
  boot: invoke('boot'),
  saveSettings: invoke('settings:set'),
  pickEngine: invoke('engine:pick'),
  devices: invoke('engine:devices'),
  pickFiles: invoke('files:pick'),
  pickOutput: invoke('output:pick'),
  importPreset: invoke('preset:import'),
  clearPreset: invoke('preset:clear'),
  start: invoke('jobs:start'),
  cancel: invoke('jobs:cancel'),
  openFolder: invoke('shell:openFolder'),
  openReleases: invoke('shell:releases'),
  pathForFile: (file) => webUtils.getPathForFile(file),
  onJob: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('job:update', h);
    return () => ipcRenderer.removeListener('job:update', h);
  },
  onFinished: (cb) => {
    const h = (_e, d) => cb(d);
    ipcRenderer.on('run:finished', h);
    return () => ipcRenderer.removeListener('run:finished', h);
  },
});
