/**
 * Emit — spec/build-v1.md §3.5, ADR-004.
 *
 * Writes the bundle and copies referenced artifacts into it.
 *
 * The archiving is not a convenience. If the source repository goes private or
 * is deleted, every "verify this" link dies and the product's core promise
 * collapses with it (edge case E-8). Copying referenced artifacts in makes the
 * site self-sufficient.
 *
 * Determinism obligations (D1): files are written in sorted order, no
 * timestamps are read, and the build clock is the injected one.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ResolvedClaim, Diagnostic } from '../model.js';

export interface Bundle {
  /** Output path relative to the bundle root, POSIX-separated. */
  readonly path: string;
  readonly content: string;
}

export interface EmitResult {
  readonly written: readonly string[];
  readonly archived: readonly string[];
}

/**
 * The diagnostics report.
 *
 * Written to the bundle root but excluded from the rendered site: SQ-3 (whether
 * diagnostics should be publishable) is unresolved, and the current position is
 * that they are the author's to see, not the reviewer's. Publishing "this author
 * declared E3 and supported E1" would be a strong integrity signal and an
 * equally strong disincentive to adopt the standard at all.
 */
export function renderDiagnostics(
  claims: readonly ResolvedClaim[],
  diagnostics: readonly Diagnostic[],
  builtAt: string,
): string {
  const lines: string[] = [
    '# Build diagnostics',
    '',
    `Built ${builtAt}.`,
    '',
    'Private to you. Not included in the published site.',
    '',
    `## Claims (${claims.length})`,
    '',
  ];

  for (const claim of claims) {
    const capped = claim.rendered === claim.declared ? '' : ` (declared ${claim.declared})`;
    lines.push(`- ${claim.rendered} ${claim.signal} ${claim.path}${capped}`);
  }

  if (diagnostics.length > 0) {
    lines.push('', `## Diagnostics (${diagnostics.length})`, '');
    for (const d of diagnostics) {
      lines.push(`- **${d.severity}** ${d.path}: ${d.message}`);
    }
  }

  return lines.join('\n');
}

/**
 * Write a bundle to disk.
 *
 * Sorted so directory creation and write order are identical between runs —
 * unsorted iteration is a classic source of non-determinism that only shows up
 * intermittently.
 */
export async function emit(
  outputRoot: string,
  bundle: readonly Bundle[],
  archive: readonly { readonly from: string; readonly to: string }[] = [],
): Promise<EmitResult> {
  const written: string[] = [];
  const archived: string[] = [];

  for (const file of [...bundle].sort((a, b) => a.path.localeCompare(b.path))) {
    const target = join(outputRoot, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, 'utf8');
    written.push(file.path);
  }

  for (const item of [...archive].sort((a, b) => a.to.localeCompare(b.to))) {
    const target = join(outputRoot, item.to);
    try {
      const content = await readFile(item.from);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
      archived.push(item.to);
    } catch {
      // A missing referenced artifact is reported upstream as a diagnostic and
      // caps the claim. It must not fail the build here.
    }
  }

  return { written, archived };
}
