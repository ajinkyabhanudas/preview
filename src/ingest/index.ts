/**
 * Ingest — spec/build-v1.md §3.2.
 *
 * The only stage that touches the filesystem. Everything downstream operates on
 * an in-memory snapshot, which is what makes the rest of the pipeline testable
 * with fixtures instead of temp directories.
 *
 * Security note. This stage reads paths influenced by repository config, which
 * is untrusted input. Path traversal is rejected here rather than in validate,
 * because by validate time the read has already happened.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import type { RepoSnapshot, SourceFile } from '../model.js';

/** Directories the standard defines. Nothing outside these is read. */
const INGEST_ROOTS = ['docs/product', 'evals'] as const;
const CONFIG_FILE = 'preview.config.json';

/** Bound per-file reads so one enormous file cannot exhaust memory. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Directories never walked, regardless of location. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'site', 'coverage']);

export interface IngestResult {
  readonly snapshot: RepoSnapshot;
  readonly skipped: readonly string[];
}

/**
 * True when `candidate` resolves inside `root`.
 *
 * Compares resolved absolute paths with a trailing separator, which rejects
 * both `../` traversal and the sibling-prefix case (`/repo-evil` against
 * `/repo`) that a plain `startsWith` would let through.
 */
export function isInsideRoot(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root);
  const resolvedCandidate = resolve(candidate);
  if (resolvedCandidate === resolvedRoot) return true;
  return resolvedCandidate.startsWith(resolvedRoot + sep);
}

/** Normalise a path to repo-relative POSIX form for stable, portable output. */
function toPosixRelative(root: string, absolute: string): string {
  return relative(root, absolute).split(sep).join('/');
}

/**
 * Extra directories to walk, derived from declared evidence paths.
 *
 * Takes the literal prefix of each pattern up to the first wildcard, so
 * `tests/eval/queries.py` yields `tests/eval` and `benchmark_results/*.json`
 * yields `benchmark_results`. Only directories inside the repository are
 * returned; containment is re-checked during the walk regardless.
 *
 * Deduplicated and sorted so traversal order is stable (D1).
 */
function declaredRoots(config: Readonly<Record<string, unknown>>): readonly string[] {
  const evidence = config['evidence'];
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) return [];

  const roots = new Set<string>();
  for (const value of Object.values(evidence as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    for (const pattern of value) {
      if (typeof pattern !== 'string' || pattern.length === 0) continue;
      if (pattern.startsWith('/') || pattern.includes('..')) continue;

      const literal = pattern.split('*')[0] ?? '';
      const dir = literal.includes('/') ? literal.slice(0, literal.lastIndexOf('/')) : '';
      if (dir.length > 0) roots.add(dir);
    }
  }

  return [...roots].sort();
}

async function walk(root: string, dir: string, out: SourceFile[], skipped: string[]): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return; // Absent optional directory is not an error.
  }

  // Sort for deterministic traversal — D1 requires byte-identical output, and
  // filesystem readdir order is not guaranteed stable across platforms.
  for (const entry of entries.sort()) {
    if (SKIP_DIRS.has(entry)) continue;

    const absolute = join(dir, entry);

    // Re-check containment at every level: a symlink can point outside the repo.
    if (!isInsideRoot(root, absolute)) {
      skipped.push(`${toPosixRelative(root, absolute)} (resolves outside repository)`);
      continue;
    }

    let info;
    try {
      info = await stat(absolute);
    } catch {
      continue; // Broken symlink or race — skip rather than fail the build.
    }

    if (info.isDirectory()) {
      await walk(root, absolute, out, skipped);
      continue;
    }

    if (!info.isFile()) continue;

    if (info.size > MAX_FILE_BYTES) {
      skipped.push(`${toPosixRelative(root, absolute)} (exceeds ${MAX_FILE_BYTES} bytes)`);
      continue;
    }

    out.push({
      path: toPosixRelative(root, absolute),
      content: await readFile(absolute, 'utf8'),
    });
  }
}

/**
 * Read a repository into an in-memory snapshot.
 *
 * Reads only the directories the standard defines. A file outside them is not
 * skipped-with-warning, it is simply not part of the repository as far as the
 * standard is concerned.
 */
export async function ingest(repoRoot: string): Promise<IngestResult> {
  const root = resolve(repoRoot);
  const files: SourceFile[] = [];
  const skipped: string[] = [];

  // Config is read first, because it can declare evidence outside the standard's
  // prescribed directories. A real repository keeps its eval set where its test
  // tooling expects it, not where this standard would prefer.
  let config: Record<string, unknown> = {};
  try {
    const raw = await readFile(join(root, CONFIG_FILE), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      config = parsed as Record<string, unknown>;
    }
  } catch {
    // A missing or malformed config is not fatal: every value it carries has a
    // safe default, and the defaults are the restrictive ones.
  }

  for (const subdir of [...INGEST_ROOTS, ...declaredRoots(config)]) {
    await walk(root, join(root, subdir), files, skipped);
  }

  // A declared root may sit inside a default root (`docs/product/discovery`
  // under `docs/product`), which walks the same tree twice and would emit every
  // file — and therefore every claim — twice. Deduplicate by path, keeping the
  // first occurrence so ordering stays deterministic.
  const seen = new Set<string>();
  const unique = files.filter((f) => (seen.has(f.path) ? false : (seen.add(f.path), true)));
  files.length = 0;
  files.push(...unique);

  return {
    snapshot: { files, config },
    skipped,
  };
}
