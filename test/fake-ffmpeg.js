// Faux ffmpeg : sonde (-i seul) et remux (-itsscale). Les fps se lisent dans le contenu du fichier (ex. "clip_120fps.mp4").
const fs = require('node:fs');
const args = process.argv.slice(2);

if (args.includes('-version')) {
  console.log('ffmpeg version fake');
  process.exit(0);
}
const input = args[args.indexOf('-i') + 1];
if (!args.includes('-itsscale')) {
  const fps = (fs.readFileSync(input, 'utf8').match(/(\d+(?:\.\d+)?)fps/) || [, '120'])[1];
  console.error(`Input #0, mov,mp4, from '${input}':\n  Stream #0:0[0x1](und): Video: h264 (High), yuv420p, 1920x1080, 12000 kb/s, ${fps} fps, ${fps} tbr`);
  console.error('At least one output file must be specified');
  process.exit(1);
}
if (process.env.FAKE_FFMPEG_FAIL) {
  console.error('Error: pas assez de place');
  process.exit(1);
}
if (process.env.FAKE_FFMPEG_LOG) fs.appendFileSync(process.env.FAKE_FFMPEG_LOG, JSON.stringify(args) + '\n');
fs.copyFileSync(input, args[args.length - 1]);
