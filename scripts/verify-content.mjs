
import fs from 'node:fs';
import path from 'node:path';

const targetsDir = path.resolve('public/targets');
const mediaDir = path.resolve('public/media');

const targets = fs.existsSync(targetsDir) ? fs.readdirSync(targetsDir).filter(f => f.endsWith('.mind')) : [];
let ok = true;
for (const t of targets) {
  const id = t.replace(/\.mind$/, '');
  const mp4 = path.join(mediaDir, id + '.mp4');
  if (!fs.existsSync(mp4)) {
    console.error(`[verify-content] Missing media for target: ${id}`);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log('[verify-content] OK');
