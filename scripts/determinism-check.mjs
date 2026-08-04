#!/usr/bin/env node
/**
 * Determinism gate — spec/build-v1.md §4.
 *
 *   render :: (RepoSnapshot, Config, BuildClock) -> (SiteBundle, Diagnostics)
 *
 * Pure. Same inputs produce byte-identical output. The clock is injected rather
 * than read, so a build is reproducible and golden-file testing is cheap.
 *
 * This script builds the same fixture twice and compares hashes per file. Any
 * difference means something impure crept in — a timestamp, a random slug, a
 * network call, an environment read, or map iteration order.
 *
 * Exit 0 = identical, or nothing to compare yet. Exit 1 = non-determinism.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = join(ROOT, 'tests/fixtures/honest-complete');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir).sort()) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

/** Map of relative path -> sha256, for every file in a bundle. */
function hashBundle(dir) {
  const map = new Map();
  for (const file of walk(dir)) {
    const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
    map.set(relative(dir, file), hash);
  }
  return map;
}

if (!existsSync(FIXTURE)) {
  console.log('determinism-check: fixture tests/fixtures/honest-complete not present yet.');
  console.log('  This gate activates once B2–B6 land and the fixture exists.');
  console.log('  See spec/build-v1.md §2 for build order and §5.2 for fixtures.');
  process.exit(0);
}

let build;
try {
  ({ build } = await import('../dist/index.js'));
} catch {
  console.log('determinism-check: dist/ not built yet — run `make build` first. Skipping.');
  process.exit(0);
}

// A fixed clock. Reading the real clock here would make this test pass
// trivially on speed and fail randomly across a second boundary — the exact
// bug the injected clock exists to prevent.
const CLOCK = new Date('2026-09-14T00:00:00.000Z');

// Two builds into separate directories, then compare hashes per file. Building
// into the same directory would let a stale file from run 1 mask a difference
// in run 2.
const outA = join(ROOT, '.determinism/a');
const outB = join(ROOT, '.determinism/b');
rmSync(join(ROOT, '.determinism'), { recursive: true, force: true });

await build(FIXTURE, outA, { clock: CLOCK });
await build(FIXTURE, outB, { clock: CLOCK });

const first = hashBundle(outA);
const second = hashBundle(outB);

const paths = new Set([...first.keys(), ...second.keys()]);
const diffs = [];

for (const path of [...paths].sort()) {
  const a = first.get(path);
  const b = second.get(path);
  if (a === undefined) diffs.push(`only in build 2: ${path}`);
  else if (b === undefined) diffs.push(`only in build 1: ${path}`);
  else if (a !== b) diffs.push(`differs: ${path}`);
}

if (diffs.length > 0) {
  console.error('determinism-check: FAILED — two builds of the same input differ.\n');
  for (const d of diffs) console.error(`  ${d}`);
  console.error('\nSomething impure is in the pipeline: a clock read, a random value,');
  console.error('an environment read, a network call, or unstable iteration order.');
  process.exit(1);
}

rmSync(join(ROOT, '.determinism'), { recursive: true, force: true });
console.log(`determinism-check: identical — ${paths.size} file(s) byte-for-byte.`);
