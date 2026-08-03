#!/usr/bin/env node
/**
 * Link and reference checker for the documentation surface.
 *
 * Added after a repository restructure left two specs pointing at filenames
 * that no longer existed (`SPEC-preview-standard-v0.1.md` after the move into
 * `spec/`), and the README citing a section that does not discuss what it
 * claimed. Both survived review because nothing mechanically checks prose.
 *
 * Checks three things:
 *   1. Every relative markdown link resolves to a file that exists.
 *   2. Every `#anchor` on an internal link matches a real heading.
 *   3. No document references a `SPEC-preview-*` filename (pre-restructure).
 *
 * Exit 0 = clean. Exit 1 = a reference is broken.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', 'dist', 'site', 'coverage']);

function markdownFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir).sort()) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...markdownFiles(path));
    else if (entry.endsWith('.md')) out.push(path);
  }
  return out;
}

/** GitHub's heading-to-anchor slug rules, close enough for our headings. */
function slug(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function anchorsIn(file) {
  const set = new Set();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^#{1,6}\s+(.*)$/.exec(line);
    if (m?.[1] !== undefined) set.add(slug(m[1]));
  }
  return set;
}

const failures = [];
const files = markdownFiles(ROOT);

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);

  // 3. Pre-restructure filenames.
  for (const m of content.matchAll(/SPEC-preview-[\w.-]+\.md/g)) {
    failures.push(`${rel}: references pre-restructure filename "${m[0]}"`);
  }

  // 1 & 2. Relative links.
  for (const m of content.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (target === undefined) continue;
    if (/^(https?:|mailto:|#)/.test(target)) continue;

    const [pathPart, anchor] = target.split('#');
    if (pathPart === undefined || pathPart.length === 0) continue;

    const resolved = resolve(dirname(file), pathPart);
    if (!existsSync(resolved)) {
      failures.push(`${rel}: link target does not exist -> ${target}`);
      continue;
    }

    if (anchor !== undefined && anchor.length > 0 && resolved.endsWith('.md')) {
      if (!anchorsIn(resolved).has(anchor)) {
        failures.push(`${rel}: anchor not found -> ${target}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('link-check: FAILED\n');
  for (const f of failures) console.error(`  ${f}`);
  console.error(`\n${failures.length} broken reference(s) across ${files.length} file(s).`);
  process.exit(1);
}

console.log(`link-check: clean — ${files.length} markdown file(s), all references resolve.`);
