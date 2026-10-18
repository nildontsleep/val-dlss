// Faux VE_CLI : imite la CLI de Visual Enhancer pour tester Engine sans GPU ni Windows.
const [cmd, input, ...rest] = process.argv.slice(2);
const flag = (n) => rest[rest.indexOf(n) + 1];

if (cmd === 'devices') {
  console.log('GPU 0: NVIDIA GeForce RTX 5070 Ti');
  process.exit(0);
}
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
    console.log(JSON.stringify({ output: `${flag('-o')}/out.mp4`, style: flag('--style') }));
  }
}, 20);
process.on('SIGTERM', () => process.exit(143));
