'use strict';
const path = require('node:path');

const VIDEO = ['.mp4', '.mkv', '.mov', '.avi', '.webm', '.m4v'];

const isVideo = (file) => VIDEO.includes(path.extname(String(file)).toLowerCase());

module.exports = { VIDEO, isVideo };
