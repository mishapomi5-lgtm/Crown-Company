/**
 * Build script for the Electron main process and preload script.
 *
 * Both are compiled from TypeScript to CommonJS via esbuild.
 * CommonJS is required for the Electron main process (Electron 35 does not
 * support top-level await in the entry point without special flags).
 */
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

await rm(distDir, { recursive: true, force: true });

const sharedConfig = {
  bundle: true,
  platform: /** @type {const} */ ('node'),
  target: 'node22',
  format: /** @type {const} */ ('cjs'),
  // electron is provided by the Electron runtime — never bundle it.
  external: ['electron'],
  logLevel: /** @type {const} */ ('info'),
};

// ── Main process ────────────────────────────────────────────────────────────
await build({
  ...sharedConfig,
  entryPoints: [path.join(__dirname, 'src/main.ts')],
  outfile: path.join(distDir, 'main.js'),
  sourcemap: 'linked',
});

// ── Preload script ──────────────────────────────────────────────────────────
await build({
  ...sharedConfig,
  entryPoints: [path.join(__dirname, 'src/preload.ts')],
  outfile: path.join(distDir, 'preload.js'),
  sourcemap: 'linked',
});

console.log('\n✓ Electron main + preload built to', distDir);
