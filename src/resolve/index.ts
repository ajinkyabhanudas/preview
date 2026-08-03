/**
 * Resolve — spec/build-v1.md §3.4. The security-relevant stage.
 *
 * Computes the tier a repository actually supports for each claim, then caps
 * the declaration against it:
 *
 *   rendered = min(declared, supported)
 *
 * Rules binding on this file:
 *
 *  - Any error inside supportedTier resolves to E0, never to the declared
 *    value. Failing open here means an internal bug silently grants whatever
 *    the author claimed — the exact inversion of P4.
 *  - Pure. No filesystem, no clock, no environment.
 *  - No code path returns a tier above either input.
 *
 * Keep this file small and dependency-free. It is the one place where a subtle
 * bug is a false statement made to someone making a hiring decision.
 */

import { isAtLeast, isOverclaim, minTier, type Tier } from '../tier.js';
import type { Claim, Diagnostic, ResolvedClaim } from '../model.js';
import { isJudgmentSignal } from '../model.js';

/** Evidence the repository provides, as computed by validate. */
export interface SupportContext {
  /** Discovery synthesis with n, method, segment, recruitment all populated. */
  readonly hasDiscoverySynthesis: boolean;
  /** A non-empty golden set file exists. */
  readonly hasGoldenSet: boolean;
  /** A baseline record carrying a date and a golden_set_sha. */
  readonly baselineSha: string | undefined;
  /** An instrumentation manifest plus dataset with n, range, denominator. */
  readonly hasInstrumentation: boolean;
  /** A comparison spec with named arms and per-arm n. */
  readonly hasComparisonSpec: boolean;
}

export const EMPTY_SUPPORT: SupportContext = Object.freeze({
  hasDiscoverySynthesis: false,
  hasGoldenSet: false,
  baselineSha: undefined,
  hasInstrumentation: false,
  hasComparisonSpec: false,
});

/**
 * The highest tier the repository can support for this claim.
 *
 * Walks the ladder upward and stops at the first unmet requirement, so a claim
 * can never skip a rung it has not earned.
 *
 * Requirements are spec/standard-v0.1.md §4.3.
 */
export function supportedTier(claim: Claim, ctx: SupportContext): Tier {
  // E0 and E1 require nothing. Every claim reaches at least E1.
  let supported: Tier = 'E1';

  // E2 — coded qualitative work with n stated.
  if (!ctx.hasDiscoverySynthesis || claim.n === undefined || claim.n <= 0) return supported;
  supported = 'E2';

  // E3 — frozen, hash-pinned evaluation.
  //
  // The hash equality check is the defence against the highest-value gaming
  // vector: quietly editing the test set until the number improves. A version
  // string is a claim; a hash is a fact. If the set changed between baseline
  // and result, the comparison is meaningless and the claim stops here.
  if (!ctx.hasGoldenSet) return supported;
  if (ctx.baselineSha === undefined || claim.goldenSetSha === undefined) return supported;
  if (ctx.baselineSha !== claim.goldenSetSha) return supported;
  supported = 'E3';

  // E4 — instrumented real usage.
  if (!ctx.hasInstrumentation) return supported;
  supported = 'E4';

  // E5 — controlled comparison.
  if (!ctx.hasComparisonSpec) return supported;
  return 'E5';
}

/**
 * Retrospective decision claims cap at E0 without an anchor.
 *
 * spec/standard-v0.1.md §6.2. Stricter for decisions than for measurements
 * because hindsight quietly upgrades every decision into one you reasoned your
 * way to. A reconstructed measurement is either supported by the data or it is
 * not; a reconstructed decision is a story, and stories improve in the retelling
 * without anyone intending to lie.
 */
function anchorCap(claim: Claim): Tier | undefined {
  const isDecisionClaim = claim.signal === 'S6' || isJudgmentSignal(claim.signal);
  if (!claim.retrospective || !isDecisionClaim) return undefined;

  const anchored = claim.anchor !== undefined && claim.anchor.trim().length > 0;
  return anchored ? undefined : 'E0';
}

export interface ResolutionOutcome {
  readonly claim: ResolvedClaim;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Resolve one claim. Never throws.
 *
 * An internal failure produces E0 plus an error diagnostic, because the
 * alternative — propagating an exception — would either fail the whole build
 * (punishing an author for someone else's bug) or, worse, be caught upstream by
 * something that falls back to the declared value.
 */
export function resolveClaim(claim: Claim, ctx: SupportContext): ResolutionOutcome {
  const diagnostics: Diagnostic[] = [];

  let supported: Tier;
  try {
    supported = supportedTier(claim, ctx);

    const cap = anchorCap(claim);
    if (cap !== undefined) {
      supported = minTier(supported, cap);
      diagnostics.push({
        severity: 'warn',
        path: claim.path,
        code: 'unanchored-retrospective',
        message:
          'Retrospective decision claim cites no anchor predating the reconstruction. ' +
          'Capped at E0 and rendered with a visible unanchored flag.',
      });
    }
  } catch (error) {
    // Fail closed. E0, never the declaration.
    return {
      claim: { ...claim, supported: 'E0', rendered: 'E0' },
      diagnostics: [
        {
          severity: 'error',
          path: claim.path,
          code: 'resolver-internal-error',
          message: `Tier resolution failed; claim capped at E0. ${String(error)}`,
        },
      ],
    };
  }

  const rendered = minTier(claim.declared, supported);

  if (isOverclaim(claim.declared, supported)) {
    diagnostics.push({
      severity: 'warn',
      path: claim.path,
      code: 'tier-overclaim',
      message:
        `Declared ${claim.declared} but the repository supports ${supported}. ` +
        `Rendering at ${rendered}.`,
    });
  }

  // Hash mismatch is the gaming signature and must not be quiet
  // (spec/build-v1.md §3.3).
  if (
    isAtLeast(claim.declared, 'E3') &&
    ctx.baselineSha !== undefined &&
    claim.goldenSetSha !== undefined &&
    ctx.baselineSha !== claim.goldenSetSha
  ) {
    diagnostics.push({
      severity: 'error',
      path: claim.path,
      code: 'golden-set-hash-mismatch',
      message:
        'The golden set changed between the baseline and this result. The ' +
        'comparison is not meaningful and the claim cannot be supported above E2.',
    });
  }

  return {
    claim: { ...claim, supported, rendered },
    diagnostics,
  };
}

/** Resolve every claim. Order is preserved for deterministic output. */
export function resolveAll(
  claims: readonly Claim[],
  ctx: SupportContext,
): { readonly claims: readonly ResolvedClaim[]; readonly diagnostics: readonly Diagnostic[] } {
  const resolved: ResolvedClaim[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const claim of claims) {
    const outcome = resolveClaim(claim, ctx);
    resolved.push(outcome.claim);
    diagnostics.push(...outcome.diagnostics);
  }

  return { claims: resolved, diagnostics };
}
