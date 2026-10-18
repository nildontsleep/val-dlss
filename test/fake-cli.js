// Faux VE_CLI : imite la CLI de Visual Enhancer pour tester Engine sans GPU ni Windows.
const fs = require('node:fs');
const path = require('node:path');
const [cmd, input, ...rest] = process.argv.slice(2);
const flag = (n) => rest[rest.indexOf(n) + 1];

if (input && input.includes('fail')) {
  console.error('Error: fichier illisible');
  process.exit(2);
}
let p = 0;
const timer = setInterval(() => {
  p += 25;
  process.stderr.write(`Rendering ${p}%\r`);
  if (p >= 100) {
    clearInterval(timer);
    const out = path.join(flag('-o'), `${path.parse(input).name}_Neural_Rendering.mp4`);
    fs.mkdirSync(flag('-o'), { recursive: true });
    fs.writeFileSync(out, input); // le contenu rappelle l'entrée : le faux ffmpeg s'en sert pour deviner les fps
    console.log(JSON.stringify({ output: out, style: flag('--style') }));
  }
}, 20);
process.on('SIGTERM', () => process.exit(143));
