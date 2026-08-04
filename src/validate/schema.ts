/**
 * Schema validation — spec/standard-v0.1.md §4, spec/build-v1.md §3.3.
 *
 * Turns parsed front matter into `Claim`s, and computes the `SupportContext`
 * describing what evidence the repository actually contains.
 *
 * The governing rule for every coercion below: **never coerce toward a higher
 * tier.** `n: "many"` is not a number, it is absent. A field that cannot be read
 * confidently is undefined, and undefined always costs the author tier rather
 * than granting it. Under-crediting is an annoyance; over-crediting is the
 * product failing at its only promise.
 */

import { parseTier } from '../tier.js';
import {
  isSignal,
  parseVisibility,
  type Claim,
  type Diagnostic,
  type ParsedDocument,
  type RawFrontMatter,
} from '../model.js';
import type { SupportContext } from '../resolve/index.js';
import {
  DEFAULT_EVIDENCE_MAP,
  resolveEvidence,
  type EvidenceMap,
} from './evidence-map.js';

/**
 * Render an untrusted value for a diagnostic message.
 *
 * Front matter is arbitrary YAML, so a field can hold a nested map or list.
 * `String()` on those yields "[object Object]", which tells the author nothing
 * about what they actually wrote. JSON round-tripping shows the real shape, and
 * the length bound keeps a pathological document from producing a diagnostic
 * larger than the file.
 */
function describeValue(value: unknown): string {
  let text: string;
  if (typeof value === 'string') {
    text = value;
  } else {
    try {
      text = JSON.stringify(value) ?? String(value);
    } catch {
      // Circular structures and BigInt both throw here.
      text = '[unrepresentable]';
    }
  }
  // The bound applies to every branch, including plain strings — an author can
  // put a five-thousand-character string in a tier field just as easily as a
  // nested map, and a diagnostic must never be larger than the mistake.
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

/** A positive integer, or undefined. Strings are never coerced. */
function readCount(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isInteger(value) || value <= 0) return undefined;
  return value;
}

/** A non-empty trimmed string, or undefined. */
function readText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** An ISO date (YYYY-MM-DD) that is also a real calendar date. */
function readDate(value: unknown): string | undefined {
  const text = readText(value);
  if (text === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  // Round-trip catches 2026-02-30, which Date silently rolls forward.
  return parsed.toISOString().slice(0, 10) === text ? text : undefined;
}

/** A hex SHA. Length is not fixed so shortened hashes remain usable. */
function readSha(value: unknown): string | undefined {
  const text = readText(value);
  if (text === undefined || !/^[0-9a-f]{7,64}$/i.test(text)) return undefined;
  return text.toLowerCase();
}

/**
 * Read `retrospective`.
 *
 * Defaults to **true** when absent or unreadable. This inverts the usual
 * "absent means false" convention on purpose: an unlabelled reconstruction is
 * the failure mode §6 exists to prevent, and the cost of wrongly labelling
 * contemporaneous work as retrospective is a visible flag the author removes in
 * seconds. The reverse is undetected backdating.
 */
function readRetrospective(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true;
}

export interface ValidationResult {
  readonly claims: readonly Claim[];
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Build a `Claim` from one document, or `undefined` when it makes no claim.
 *
 * A document without a recognised `signal` is not an error — most files in a
 * repository are prose. Only a document declaring a signal is held to the
 * schema.
 */
export function validateDocument(doc: ParsedDocument): {
  readonly claim: Claim | undefined;
  readonly diagnostics: readonly Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const fm: RawFrontMatter = doc.frontMatter;

  if (!isSignal(fm['signal'])) {
    if (fm['signal'] !== undefined) {
      diagnostics.push({
        severity: 'warn',
        path: doc.path,
        code: 'unknown-signal',
        message:
          `Unrecognised signal "${describeValue(fm['signal'])}". Expected S1-S8 or J1-J4. ` +
          'This document makes no claim.',
      });
    }
    return { claim: undefined, diagnostics };
  }

  const declared = parseTier(fm['tier']);
  if (fm['tier'] !== undefined && declared === 'E0' && fm['tier'] !== 'E0') {
    diagnostics.push({
      severity: 'warn',
      path: doc.path,
      code: 'unreadable-tier',
      message:
        `Tier declaration "${describeValue(fm['tier'])}" is not on the ladder. ` +
        'Treating the claim as E0.',
    });
  }

  const n = readCount(fm['n']);
  if (fm['n'] !== undefined && n === undefined) {
    diagnostics.push({
      severity: 'warn',
      path: doc.path,
      code: 'unreadable-n',
      message:
        `Field "n" is not a positive integer (${describeValue(fm['n'])}). ` +
        'Treating it as absent, which caps the claim below E2.',
    });
  }

  const visibility = parseVisibility(fm['visibility']);
  if (fm['visibility'] !== undefined && !(typeof fm['visibility'] === 'string' && ['public', 'redacted', 'unlisted', 'private'].includes(fm['visibility']))) {
    diagnostics.push({
      severity: 'error',
      path: doc.path,
      code: 'unreadable-visibility',
      message:
        `Visibility "${describeValue(fm['visibility'])}" is not recognised. ` +
        'Defaulting to private — this document will not be published.',
    });
  }

  return {
    claim: {
      path: doc.path,
      signal: fm['signal'],
      declared,
      visibility,
      n,
      date: readDate(fm['date']),
      goldenSetSha: readSha(fm['golden_set_sha']),
      retrospective: readRetrospective(fm['retrospective']),
      anchor: readText(fm['anchor']),
      provenance: readText(fm['provenance']),
    },
    diagnostics,
  };
}

/** Validate every document. Order preserved for deterministic output. */
export function validateAll(documents: readonly ParsedDocument[]): ValidationResult {
  const claims: Claim[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const doc of documents) {
    const result = validateDocument(doc);
    if (result.claim !== undefined) claims.push(result.claim);
    diagnostics.push(...result.diagnostics);
  }

  return { claims, diagnostics };
}

/**
 * Compute what the repository supports — spec/standard-v0.1.md §4.3.
 *
 * Every field here is derived from files that exist, never from a declaration.
 * This is the "supported" half of `min(declared, supported)`, and it is the
 * reason a tier cannot be claimed into existence.
 */
export function buildSupportContext(
  documents: readonly ParsedDocument[],
  claims: readonly Claim[],
  evidence: EvidenceMap = DEFAULT_EVIDENCE_MAP,
): SupportContext {
  const byPath = new Map(documents.map((d) => [d.path, d]));
  const allPaths = documents.map((d) => d.path);

  /** Documents matching a declared evidence kind. */
  const matching = (kind: Parameters<typeof resolveEvidence>[1]): readonly ParsedDocument[] =>
    resolveEvidence(evidence, kind, allPaths)
      .map((p) => byPath.get(p))
      .filter((d): d is ParsedDocument => d !== undefined);

  // E2 — discovery synthesis with n, method, segment, recruitment populated.
  const synthesis = matching('discovery')[0];
  const hasDiscoverySynthesis =
    synthesis !== undefined &&
    readCount(synthesis.frontMatter['n']) !== undefined &&
    readText(synthesis.frontMatter['method']) !== undefined &&
    readText(synthesis.frontMatter['segment']) !== undefined &&
    readText(synthesis.frontMatter['recruitment']) !== undefined;

  // E3 — a non-empty golden set must exist on disk. Its location is declared
  // by the author, because a real repository organises evidence around its own
  // testing conventions rather than around this standard's layout.
  const hasGoldenSet = matching('goldenSet').some((d) => d.body.trim().length > 0);

  // E3 — the baseline's hash is the reference every result is compared against.
  const baselineDoc = matching('baseline')[0];
  const baselineSha =
    baselineDoc !== undefined ? readSha(baselineDoc.frontMatter['golden_set_sha']) : undefined;

  // E4 / E5 — presence only; the schema checks live in the claims themselves.
  const hasInstrumentation = matching('instrumentation').length > 0;
  const hasComparisonSpec = matching('comparison').length > 0;

  // `claims` is accepted so future rules can depend on cross-claim state
  // (e.g. a results record referencing a baseline that no claim declares)
  // without changing this function's signature.
  void claims;

  return {
    hasDiscoverySynthesis,
    hasGoldenSet,
    baselineSha,
    hasInstrumentation,
    hasComparisonSpec,
  };
}
