/**
 * Front matter parsing — spec/build-v1.md §3.3.
 *
 * This is the untrusted boundary. Everything entering here was written by an
 * author who has an interest in the tier that comes out the other end, so the
 * rules are:
 *
 *  - Never throw on bad input. A malformed document degrades to E0 and reports;
 *    it does not fail the build (spec/build-v1.md §3.3, ADR-002).
 *  - Never coerce toward a higher tier. `n: "many"` is not 4; it is absent.
 *  - Bound the work. A pathological document must not hang the build.
 */

import { parse as parseYaml } from 'yaml';
import type { Diagnostic, ParsedDocument, RawFrontMatter, SourceFile } from '../model.js';

/** Front matter beyond this is a structural mistake, not a long document. */
const MAX_FRONT_MATTER_CHARS = 16 * 1024;

export interface ParseResult {
  readonly documents: readonly ParsedDocument[];
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Split a file into its front matter block and body.
 *
 * Returns `undefined` for `frontMatter` when the file has none, which is a
 * legitimate state — not every file in a repository makes a claim.
 */
export function splitFrontMatter(
  content: string,
): { readonly raw: string | undefined; readonly body: string } {
  if (!content.startsWith('---')) return { raw: undefined, body: content };

  const end = content.indexOf('\n---', 3);
  if (end === -1) {
    // Unterminated. Treat the whole file as body rather than guessing where the
    // block was meant to stop — guessing here would let a partial block declare
    // a tier.
    return { raw: undefined, body: content };
  }

  const raw = content.slice(3, end);
  const afterMarker = content.indexOf('\n', end + 1);
  const body = afterMarker === -1 ? '' : content.slice(afterMarker + 1);

  return { raw, body };
}

/**
 * Parse one file's front matter.
 *
 * Never throws. On any parse failure the document is returned with empty front
 * matter, which downstream resolves to E0 — the declaration is lost, and losing
 * a declaration is always safe. The reverse would not be.
 */
export function parseDocument(file: SourceFile): {
  readonly document: ParsedDocument;
  readonly diagnostics: readonly Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const { raw, body } = splitFrontMatter(file.content);

  if (raw === undefined) {
    return {
      document: { path: file.path, frontMatter: {}, body },
      diagnostics,
    };
  }

  if (raw.length > MAX_FRONT_MATTER_CHARS) {
    diagnostics.push({
      severity: 'error',
      path: file.path,
      code: 'front-matter-too-large',
      message:
        `Front matter exceeds ${MAX_FRONT_MATTER_CHARS} characters. ` +
        'Treating the document as having no declaration.',
    });
    return { document: { path: file.path, frontMatter: {}, body }, diagnostics };
  }

  let parsed: unknown;
  try {
    // `yaml` does not evaluate custom tags or resolve merge keys by default,
    // so this cannot instantiate arbitrary objects from author input.
    parsed = parseYaml(raw, { merge: false, maxAliasCount: 100 });
  } catch (error) {
    diagnostics.push({
      severity: 'error',
      path: file.path,
      code: 'malformed-front-matter',
      message:
        `Front matter is not valid YAML; the document degrades to E0. ${String(error)}`,
    });
    return { document: { path: file.path, frontMatter: {}, body }, diagnostics };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    if (parsed !== null) {
      diagnostics.push({
        severity: 'error',
        path: file.path,
        code: 'front-matter-not-a-mapping',
        message: 'Front matter must be a mapping of keys to values; degrading to E0.',
      });
    }
    return { document: { path: file.path, frontMatter: {}, body }, diagnostics };
  }

  return {
    document: { path: file.path, frontMatter: parsed as RawFrontMatter, body },
    diagnostics,
  };
}

/** Parse every file. Order is preserved for deterministic output. */
export function parseAll(files: readonly SourceFile[]): ParseResult {
  const documents: ParsedDocument[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const file of files) {
    const result = parseDocument(file);
    documents.push(result.document);
    diagnostics.push(...result.diagnostics);
  }

  return { documents, diagnostics };
}
