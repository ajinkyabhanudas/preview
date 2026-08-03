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

  for (const subdir of INGEST_ROOTS) {
    await walk(root, join(root, subdir), files, skipped);
  }

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

  return {
    snapshot: { files, config },
    skipped,
  };
}
