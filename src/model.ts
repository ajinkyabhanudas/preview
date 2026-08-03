/**
 * The domain model.
 *
 * Two rules govern this file:
 *
 * 1. There is no aggregate tier type. Per spec/standard-v0.1.md §2.2, claims
 *    carry tiers and projects do not. Not representing an aggregate makes
 *    computing one impossible rather than merely discouraged.
 *
 * 2. Untrusted input is typed as untrusted. `RawFrontMatter` is whatever was in
 *    the file; `Claim` is what survived validation. The type system should make
 *    it awkward to read a tier off the former.
 */

import type { Tier } from './tier.js';

/** Evidence signals (artifact-tiered) and judgment signals (honour-system). */
export const EVIDENCE_SIGNALS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'] as const;
export const JUDGMENT_SIGNALS = ['J1', 'J2', 'J3', 'J4'] as const;

export type EvidenceSignal = (typeof EVIDENCE_SIGNALS)[number];
export type JudgmentSignal = (typeof JUDGMENT_SIGNALS)[number];
export type Signal = EvidenceSignal | JudgmentSignal;

export function isEvidenceSignal(v: unknown): v is EvidenceSignal {
  return typeof v === 'string' && (EVIDENCE_SIGNALS as readonly string[]).includes(v);
}

export function isJudgmentSignal(v: unknown): v is JudgmentSignal {
  return typeof v === 'string' && (JUDGMENT_SIGNALS as readonly string[]).includes(v);
}

export function isSignal(v: unknown): v is Signal {
  return isEvidenceSignal(v) || isJudgmentSignal(v);
}

/** Visibility levels — spec/standard-v0.1.md §10.1. */
export const VISIBILITIES = ['public', 'redacted', 'unlisted', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export function isVisibility(v: unknown): v is Visibility {
  return typeof v === 'string' && (VISIBILITIES as readonly string[]).includes(v);
}

/**
 * Parse an untrusted visibility value.
 *
 * Unrecognised or absent values resolve to `private` — the most restrictive
 * level, not the most permissive. A typo in `visibility:` must never cause
 * content to be published. This is P4 (fail down) applied to disclosure rather
 * than to tier, and it is the more consequential of the two: an under-credited
 * claim is an annoyance, a wrongly-published one can break a client agreement.
 */
export function parseVisibility(v: unknown): Visibility {
  return isVisibility(v) ? v : 'private';
}

/** Front matter exactly as it appeared in the file. Nothing here is trusted. */
export interface RawFrontMatter {
  readonly [key: string]: unknown;
}

/** A file discovered during ingest, before any parsing. */
export interface SourceFile {
  /** Repo-relative POSIX path. Never absolute — see ingest path safety. */
  readonly path: string;
  readonly content: string;
}

/** A file that has been parsed into front matter plus body. */
export interface ParsedDocument {
  readonly path: string;
  readonly frontMatter: RawFrontMatter;
  readonly body: string;
}

/** A validated claim. Reaching this type means schema checks passed. */
export interface Claim {
  readonly path: string;
  readonly signal: Signal;
  /** What the author asserted. Untrusted — never render this directly. */
  readonly declared: Tier;
  readonly visibility: Visibility;
  readonly n: number | undefined;
  readonly date: string | undefined;
  readonly goldenSetSha: string | undefined;
  readonly retrospective: boolean;
  readonly anchor: string | undefined;
  readonly provenance: string | undefined;
}

/** A claim after tier resolution. This is what renders. */
export interface ResolvedClaim extends Claim {
  /** What the repository actually supports. Computed, never read from input. */
  readonly supported: Tier;
  /** min(declared, supported). The only tier that may be displayed. */
  readonly rendered: Tier;
}

export type DiagnosticSeverity = 'info' | 'warn' | 'error';

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

/** A repository after ingest and filtering, before validation. */
export interface RepoSnapshot {
  readonly files: readonly SourceFile[];
  readonly config: RawFrontMatter;
}
