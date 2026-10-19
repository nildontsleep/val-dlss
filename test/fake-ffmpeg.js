// Faux ffmpeg : sonde (-i seul), extraction d'une frame, remux (-itsscale).
// Les fps se lisent dans le contenu du fichier (ex. "clip_120fps.mp4"), la durée vaut 12,5 s.
const fs = require('node:fs');
const args = process.argv.slice(2);

if (args.includes('-version')) {
  console.log('ffmpeg version fake');
  process.exit(0);
}
const input = args[args.indexOf('-i') + 1];
if (args.includes('-frames:v')) {
  if (process.env.FAKE_FFMPEG_NOFRAME) process.exit(1);
  fs.writeFileSync(args[args.length - 1], `frame@${args[args.indexOf('-ss') + 1]}`);
  process.exit(0);
}
if (!args.includes('-itsscale')) {
  const fps = (fs.readFileSync(input, 'utf8').match(/(\d+(?:\.\d+)?)fps/) || [, '120'])[1];
  console.error(`Input #0, mov,mp4, from '${input}':\n  Duration: 00:00:12.50, start: 0.000000, bitrate: 12000 kb/s`);
  console.error(`  Stream #0:0[0x1](und): Video: h264 (High), yuv420p, 1920x1080, 12000 kb/s, ${fps} fps, ${fps} tbr`);
  console.error('At least one output file must be specified');
  process.exit(1);
}
if (process.env.FAKE_FFMPEG_FAIL) {
  console.error('Error: pas assez de place');
  process.exit(1);
}
if (process.env.FAKE_FFMPEG_LOG) fs.appendFileSync(process.env.FAKE_FFMPEG_LOG, JSON.stringify(args) + '\n');
fs.copyFileSync(input, args[args.length - 1]);
