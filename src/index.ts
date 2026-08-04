/**
 * The pipeline — spec/build-v1.md §3.
 *
 *   ingest -> filter -> validate -> resolve
 *
 * Render and emit are not built yet (B5, B6), so this stops at resolution and
 * returns the resolved claims plus diagnostics. That is deliberate: B4 was the
 * hard gate, and nothing renders until the invariant is proven.
 *
 * Purity (ADR-001): no network, no ambient clock, no environment reads. The
 * clock is injected. Ingest is the only stage touching the filesystem, and it
 * runs once at the entry point.
 */

import { join } from 'node:path';
import { ingest } from './ingest/index.js';
import { filterByVisibility } from './filter/index.js';
import { parseAll } from './validate/frontmatter.js';
import { buildSupportContext, validateAll } from './validate/schema.js';
import { resolveAll } from './resolve/index.js';
import { renderDocument, type FrontDoor } from './render/document.js';
import { emit, renderDiagnostics, type EmitResult } from './emit/index.js';
import type { Diagnostic, ResolvedClaim } from './model.js';

export interface BuildOptions {
  /**
   * Injected build clock. Required rather than optional so a caller cannot
   * accidentally get non-deterministic output by omitting it — the determinism
   * gate exists precisely because that mistake is easy and invisible.
   */
  readonly clock: Date;
}

export interface BuildReport {
  readonly claims: readonly ResolvedClaim[];
  readonly diagnostics: readonly Diagnostic[];
  /** Paths dropped before parsing. Never includes content. */
  readonly droppedPrivate: readonly string[];
  /** Files skipped at ingest, with the reason. */
  readonly skipped: readonly string[];
  readonly builtAt: string;
}

/**
 * Run the pipeline over a repository.
 *
 * Never throws on author error. Malformed input produces diagnostics and
 * degraded tiers, because failing the build punishes the optimistic author for
 * a drafting mistake and pushes people off the tool entirely (ADR-002).
 */
export async function analyse(repoRoot: string, options: BuildOptions): Promise<BuildReport> {
  // 1. Ingest — the only filesystem stage.
  const { snapshot, skipped } = await ingest(repoRoot);

  // 2. Filter — private content is dropped BEFORE parsing (ADR-003). Anything
  //    after this line has already had private artifacts removed.
  const { kept, dropped } = filterByVisibility(snapshot.files);

  // 3. Validate — parse front matter, then apply the schema.
  const parsed = parseAll(kept);
  const validated = validateAll(parsed.documents);

  // 4. Resolve — min(declared, supported). The security-relevant stage.
  const support = buildSupportContext(parsed.documents, validated.claims);
  const resolved = resolveAll(validated.claims, support);

  return {
    claims: resolved.claims,
    diagnostics: [...parsed.diagnostics, ...validated.diagnostics, ...resolved.diagnostics],
    droppedPrivate: dropped.map((d) => d.path),
    skipped,
    builtAt: options.clock.toISOString(),
  };
}

/**
 * Build a site from a repository.
 *
 * The full pipeline: ingest → filter → validate → resolve → render → emit.
 * Pure apart from the filesystem reads at ingest and the writes at emit, and
 * deterministic given the same repository and clock (D1).
 */
export async function build(
  repoRoot: string,
  outputRoot: string,
  options: BuildOptions & { readonly front?: FrontDoor },
): Promise<{ readonly report: BuildReport; readonly emitted: EmitResult }> {
  const report = await analyse(repoRoot, options);

  const front: FrontDoor = options.front ?? {
    title: 'Portfolio',
    problem: '[MEASURE: state the problem as a cost borne by someone.]',
    decision: '[MEASURE: name the hardest decision and what it gave up.]',
    gotWrong: '[MEASURE: state what you got wrong. This is required.]',
  };

  const html = renderDocument(front, report.claims, report.builtAt);
  const diagnostics = renderDiagnostics(report.claims, report.diagnostics, report.builtAt);

  // Referenced artifacts are copied in so the site survives the source
  // repository going private (ADR-004, edge case E-8).
  const archive = report.claims.map((claim) => ({
    from: join(repoRoot, claim.path),
    to: claim.path,
  }));

  const emitted = await emit(
    outputRoot,
    [
      { path: 'index.html', content: html },
      { path: 'diagnostics.md', content: diagnostics },
    ],
    archive,
  );

  return { report, emitted };
}

export { TIERS, isAtLeast, isTier, minTier, parseTier, type Tier } from './tier.js';
export * from './model.js';
export { renderDocument, type FrontDoor } from './render/document.js';
export { renderResultFigure, type Series } from './render/chart.js';
