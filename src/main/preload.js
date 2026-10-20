'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const invoke = (channel) => (arg) => ipcRenderer.invoke(channel, arg);
const listen = (channel) => (cb) => {
  const h = (_e, d) => cb(d);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

contextBridge.exposeInMainWorld('api', {
  boot: invoke('boot'),
  saveSettings: invoke('settings:set'),
  pickEngine: invoke('engine:pick'),
  pickFfmpeg: invoke('ffmpeg:pick'),
  pickFiles: invoke('files:pick'),
  pickOutput: invoke('output:pick'),
  clipInfo: invoke('clip:info'),
  preview: invoke('preview:run'),
  start: invoke('jobs:start'),
  cancel: invoke('jobs:cancel'),
  openFolder: invoke('shell:openFolder'),
  openLink: invoke('shell:link'),
  checkUpdate: invoke('update:check'),
  installUpdate: invoke('update:install'),
  pathForFile: (file) => webUtils.getPathForFile(file),
  onJob: listen('job:update'),
  onFinished: listen('run:finished'),
  onUpdateProgress: listen('update:progress'),
});
