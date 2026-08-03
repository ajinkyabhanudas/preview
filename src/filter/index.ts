/**
 * Visibility filter — spec/standard-v0.1.md §10.2, DECISIONS.md D3.
 *
 * Runs immediately after ingest and BEFORE parsing. Private artifacts never
 * enter the downstream pipeline.
 *
 * Why this ordering is a security boundary, not a preference: the output is
 * static files on a public host. Any design where private content is loaded,
 * rendered, and then hidden by styling or a client-side flag means "hidden"
 * evaluates to "present in the HTML". Filtering late is how confidentiality
 * leaks in static sites actually happen.
 *
 * This module therefore reads exactly one field — `visibility` — using a
 * deliberately minimal scanner rather than the full YAML parser. Running a
 * general parser over private content before deciding to drop it would defeat
 * the point of filtering early.
 */

import { parseVisibility, type SourceFile, type Visibility } from '../model.js';

export interface FilterResult {
  readonly kept: readonly SourceFile[];
  /** Paths dropped, with the level that caused it. Never includes content. */
  readonly dropped: readonly { readonly path: string; readonly visibility: Visibility }[];
}

/**
 * Extract the `visibility` value from front matter without a YAML parse.
 *
 * Handles the shapes front matter actually takes — quoted, unquoted, with or
 * without trailing comments. Anything it cannot read confidently returns
 * undefined, which `parseVisibility` then floors to `private`.
 *
 * Being conservative here is correct: an unreadable visibility field must not
 * publish.
 */
export function scanVisibility(content: string): Visibility {
  // Front matter must be the first thing in the file.
  if (!content.startsWith('---')) return 'public';

  const end = content.indexOf('\n---', 3);
  if (end === -1) return 'private'; // Unterminated front matter — do not publish.

  const block = content.slice(3, end);

  for (const line of block.split('\n')) {
    const match = /^\s*visibility\s*:\s*(.+?)\s*$/.exec(line);
    if (!match?.[1]) continue;

    let value = match[1];
    // Strip a trailing comment, then surrounding quotes.
    const hash = value.indexOf('#');
    if (hash !== -1) value = value.slice(0, hash).trim();
    value = value.replace(/^["']|["']$/g, '').trim();

    return parseVisibility(value);
  }

  // No visibility declared. Absence is not a disclosure decision, and the
  // standard's default for an undeclared artifact is public — the author put
  // it in a repository they chose to publish. Only an explicit or malformed
  // declaration triggers the restrictive default.
  return 'public';
}

/**
 * Drop private artifacts before parsing.
 *
 * Redacted and unlisted content is retained here — both still render, under
 * constraints applied downstream. Only `private` is removed, and it is removed
 * completely: neither its content nor its path reaches any later stage.
 */
export function filterByVisibility(files: readonly SourceFile[]): FilterResult {
  const kept: SourceFile[] = [];
  const dropped: { path: string; visibility: Visibility }[] = [];

  for (const file of files) {
    const visibility = scanVisibility(file.content);
    if (visibility === 'private') {
      dropped.push({ path: file.path, visibility });
      continue;
    }
    kept.push(file);
  }

  return { kept, dropped };
}
