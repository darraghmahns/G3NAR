import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const targetsDir = path.resolve('public/targets');
const mediaDir = path.resolve('public/media');

const candidateSrcDirs = [
  path.resolve('targets-src'),
  path.resolve('src/assets/target'),
];
function pickSrcDir() {
  for (const d of candidateSrcDirs) if (fs.existsSync(d)) return d;
  return null;
}

function verifyPairs() {
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
}

function compileAll() {
  const srcDir = pickSrcDir();
  if (!srcDir) {
    console.error('[compile-targets] No source dir found. Create either `targets-src/` or `src/assets/target/` and put .png/.jpg there.');
    process.exit(1);
  }
  console.log(`[compile-targets] Using source dir: ${srcDir}`);

  if (!fs.existsSync(targetsDir)) fs.mkdirSync(targetsDir, { recursive: true });

  const srcFiles = fs.readdirSync(srcDir).filter(f => /\.(png|jpe?g)$/i.test(f));
  if (srcFiles.length === 0) {
    console.error('[compile-targets] No source images found in targets-src (.png/.jpg/.jpeg)');
    process.exit(1);
  }

  console.log(`[compile-targets] Compiling ${srcFiles.length} image(s) → ${targetsDir}`);
  let failures = 0;
  for (const file of srcFiles) {
    const base = file.replace(/\.[^.]+$/, '');
    const input = path.join(srcDir, file);
    const output = path.join(targetsDir, base + '.mind');

    // Prefer local dev dep via npx; falls back to global if installed
    const args = ['mindar-image-compiler', '--input', input, '--output', output];
    const result = spawnSync('npx', args, { stdio: 'inherit' });
    if (result.status !== 0) {
      console.error(`[compile-targets] Failed: ${file}`);
      failures++;
    } else {
      console.log(`[compile-targets] OK: ${output}`);
    }
  }
  if (failures > 0) process.exit(1);
  console.log('[compile-targets] All targets compiled successfully.');
}

// Usage:
//   node scripts/compile-targets.mjs           -> verify only
//   node scripts/compile-targets.mjs --compile -> compile from `targets-src/` or `src/assets/target/`
if (process.argv.includes('--compile')) {
  compileAll();
} else {
  verifyPairs();
}
