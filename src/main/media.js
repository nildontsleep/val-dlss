'use strict';
const path = require('node:path');

const VIDEO = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.m4v', '.ts', '.mts', '.m2ts', '.wmv', '.flv'];
const IMAGE = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.tif', '.tiff', '.bmp', '.gif', '.heic', '.heif'];

function kind(file) {
  const ext = path.extname(String(file)).toLowerCase();
  if (VIDEO.includes(ext)) return 'video';
  if (IMAGE.includes(ext)) return 'image';
  return null;
}

module.exports = { VIDEO, IMAGE, kind };
