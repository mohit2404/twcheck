const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const file of fs.readdirSync(src)) fs.copyFileSync(path.join(src, file), path.join(dist, file));
for (const file of fs.readdirSync(dist)) if (file.endsWith('.js')) fs.chmodSync(path.join(dist, file), 0o755);
