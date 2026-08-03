#!/usr/bin/env node
/**
 * Leak gate — spec/build-v1.md §5.3.
 *
 * Greps the BUILT BUNDLE against a denylist of terms that must never ship.
 *
 * Two design decisions worth understanding before editing this file:
 *
 * 1. It runs against built output, not source. The failure mode that matters
 *    is content leaking through *transformation* — a client name surviving
 *    into an alt attribute, a chart label, a generated slug, or a JSON blob —
 *    not content sitting in a file someone correctly marked private.
 *
 * 2. The denylist is gitignored. A committed list of things you cannot say is
 *    itself a disclosure of exactly those things.
 *
 * Crude, and the highest-consequence test in the suite. The failure it prevents
 * is not a bug report; it is a broken confidentiality agreement.
 *
 * Exit 0 = clean, or nothing to check. Exit 1 = a denylisted term is in output.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = join(ROOT, 'site');
const DENYLIST = join(ROOT, 'denylist.txt');

/** Read denylist terms: one per line, `#` comments and blanks ignored. */
function readDenylist() {
  if (!existsSync(DENYLIST)) return [];
  return readFileSync(DENYLIST, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/** Every file in the bundle, recursively. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const terms = readDenylist();

if (terms.length === 0) {
  // Not a pass — there is simply nothing to enforce yet. Say so plainly rather
  // than printing a green tick that implies a check ran.
  console.log('leak-check: no denylist.txt found — nothing to enforce.');
  console.log('  Create denylist.txt (gitignored, one term per line) before publishing');
  console.log('  any redacted artifact. See spec/build-v1.md §5.3.');
  process.exit(0);
}

if (!existsSync(BUNDLE)) {
  console.log('leak-check: no build output at site/ — run `make build` first. Skipping.');
  process.exit(0);
}

const files = walk(BUNDLE);
let hits = 0;

for (const file of files) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue; // binary asset
  }

  const haystack = content.toLowerCase();
  for (const term of terms) {
    if (haystack.includes(term.toLowerCase())) {
      // Never print the term itself — this output may land in a public CI log.
      console.error(`LEAK  ${relative(ROOT, file)} contains a denylisted term (#${terms.indexOf(term) + 1})`);
      hits += 1;
    }
  }
}

if (hits > 0) {
  console.error(`\n${hits} leak(s) found across ${files.length} bundle file(s).`);
  console.error('Do not publish this bundle.');
  process.exit(1);
}

console.log(`leak-check: clean — ${terms.length} term(s) checked across ${files.length} file(s).`);
