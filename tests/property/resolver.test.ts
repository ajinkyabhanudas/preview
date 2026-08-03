/**
 * Repository-level property tests for the resolver — spec/build-v1.md §5.1.
 *
 * tests/property/tier.test.ts proves the capping *function* holds its algebraic
 * properties. This file proves the properties hold over generated claims and
 * generated support contexts — the level at which real bugs live.
 *
 * PROPERTY 3 (monotonicity) is the one that earns its keep here. It catches the
 * class of bug where adding an artifact to a repository trips a check and
 * silently degrades an unrelated claim. Example tests essentially never find
 * these, and an author who hits one loses trust in the tool permanently.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { TIERS, isAtLeast, type Tier } from '../../src/tier.js';
import { EVIDENCE_SIGNALS, JUDGMENT_SIGNALS, VISIBILITIES, type Claim } from '../../src/model.js';
import { EMPTY_SUPPORT, resolveClaim, supportedTier, type SupportContext } from '../../src/resolve/index.js';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

const anyTier = (): fc.Arbitrary<Tier> => fc.constantFrom(...TIERS);

const anyClaim = (): fc.Arbitrary<Claim> =>
  fc.record({
    path: fc.constantFrom('docs/product/a.md', 'evals/b.md', 'docs/product/decisions/0001-x.md'),
    signal: fc.constantFrom(...EVIDENCE_SIGNALS, ...JUDGMENT_SIGNALS),
    declared: anyTier(),
    visibility: fc.constantFrom(...VISIBILITIES),
    n: fc.option(fc.integer({ min: -5, max: 500 }), { nil: undefined }),
    date: fc.option(fc.constantFrom('2026-09-14', 'not-a-date'), { nil: undefined }),
    goldenSetSha: fc.option(fc.constantFrom(SHA_A, SHA_B), { nil: undefined }),
    retrospective: fc.boolean(),
    anchor: fc.option(fc.constantFrom('commit 9f2c1a', '', '   '), { nil: undefined }),
    provenance: fc.option(fc.constant('frozen v1'), { nil: undefined }),
  });

const anySupport = (): fc.Arbitrary<SupportContext> =>
  fc.record({
    hasDiscoverySynthesis: fc.boolean(),
    hasGoldenSet: fc.boolean(),
    baselineSha: fc.option(fc.constantFrom(SHA_A, SHA_B), { nil: undefined }),
    hasInstrumentation: fc.boolean(),
    hasComparisonSpec: fc.boolean(),
  });

/** Order support contexts by evidence present — "adding an artifact". */
function addArtifacts(ctx: SupportContext): SupportContext {
  return {
    hasDiscoverySynthesis: true,
    hasGoldenSet: true,
    baselineSha: ctx.baselineSha ?? SHA_A,
    hasInstrumentation: true,
    hasComparisonSpec: true,
  };
}

describe('PROPERTY 1 — rendered never exceeds declared', () => {
  it('holds over generated claims and contexts', () => {
    fc.assert(
      fc.property(anyClaim(), anySupport(), (claim, ctx) => {
        const { claim: r } = resolveClaim(claim, ctx);
        expect(isAtLeast(claim.declared, r.rendered)).toBe(true);
      }),
    );
  });
});

describe('PROPERTY 2 — rendered never exceeds supported', () => {
  it('holds over generated claims and contexts', () => {
    fc.assert(
      fc.property(anyClaim(), anySupport(), (claim, ctx) => {
        const { claim: r } = resolveClaim(claim, ctx);
        expect(isAtLeast(r.supported, r.rendered)).toBe(true);
      }),
    );
  });

  it('never renders above E1 with no supporting evidence at all', () => {
    fc.assert(
      fc.property(anyClaim(), (claim) => {
        const { claim: r } = resolveClaim(claim, EMPTY_SUPPORT);
        expect(isAtLeast('E1', r.rendered)).toBe(true);
      }),
    );
  });
});

describe('PROPERTY 3 — monotonicity', () => {
  it('adding artifacts never lowers a rendered tier', () => {
    fc.assert(
      fc.property(anyClaim(), anySupport(), (claim, before) => {
        const after = addArtifacts(before);
        const { claim: r1 } = resolveClaim(claim, before);
        const { claim: r2 } = resolveClaim(claim, after);
        expect(isAtLeast(r2.rendered, r1.rendered)).toBe(true);
      }),
    );
  });

  it('adding a discovery synthesis never lowers any claim', () => {
    fc.assert(
      fc.property(anyClaim(), anySupport(), (claim, before) => {
        const after = { ...before, hasDiscoverySynthesis: true };
        const { claim: r1 } = resolveClaim(claim, before);
        const { claim: r2 } = resolveClaim(claim, after);
        expect(isAtLeast(r2.rendered, r1.rendered)).toBe(true);
      }),
    );
  });
});

describe('resolver never throws', () => {
  it('returns a resolved claim for any input combination', () => {
    fc.assert(
      fc.property(anyClaim(), anySupport(), (claim, ctx) => {
        expect(() => resolveClaim(claim, ctx)).not.toThrow();
      }),
    );
  });
});

describe('golden set hash pinning', () => {
  const base: Claim = {
    path: 'docs/product/results/2026-09-14-x.md',
    signal: 'S7',
    declared: 'E3',
    visibility: 'public',
    n: 120,
    date: '2026-09-14',
    goldenSetSha: SHA_A,
    retrospective: false,
    anchor: undefined,
    provenance: 'frozen v1',
  };

  const ctx: SupportContext = {
    hasDiscoverySynthesis: true,
    hasGoldenSet: true,
    baselineSha: SHA_A,
    hasInstrumentation: false,
    hasComparisonSpec: false,
  };

  it('supports E3 when baseline and result hashes match', () => {
    expect(supportedTier(base, ctx)).toBe('E3');
  });

  it('caps below E3 when the golden set changed', () => {
    const tampered = { ...base, goldenSetSha: SHA_B };
    expect(supportedTier(tampered, ctx)).toBe('E2');
  });

  it('emits a prominent diagnostic on mismatch — the gaming signature', () => {
    const tampered = { ...base, goldenSetSha: SHA_B };
    const { diagnostics } = resolveClaim(tampered, ctx);
    const hit = diagnostics.find((d) => d.code === 'golden-set-hash-mismatch');
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe('error');
  });
});

describe('retrospective anchoring', () => {
  const decision: Claim = {
    path: 'docs/product/decisions/0001-x.md',
    signal: 'S6',
    declared: 'E1',
    visibility: 'public',
    n: undefined,
    date: '2026-09-14',
    goldenSetSha: undefined,
    retrospective: true,
    anchor: undefined,
    provenance: undefined,
  };

  it('caps an unanchored retrospective decision at E0', () => {
    const { claim, diagnostics } = resolveClaim(decision, EMPTY_SUPPORT);
    expect(claim.rendered).toBe('E0');
    expect(diagnostics.some((d) => d.code === 'unanchored-retrospective')).toBe(true);
  });

  it('treats whitespace-only anchors as absent', () => {
    const { claim } = resolveClaim({ ...decision, anchor: '   ' }, EMPTY_SUPPORT);
    expect(claim.rendered).toBe('E0');
  });

  it('permits an anchored retrospective decision', () => {
    const { claim } = resolveClaim({ ...decision, anchor: 'commit 9f2c1a' }, EMPTY_SUPPORT);
    expect(claim.rendered).toBe('E1');
  });

  it('does not cap non-decision retrospective claims', () => {
    const measurement = { ...decision, signal: 'S7' as const };
    const { claim } = resolveClaim(measurement, EMPTY_SUPPORT);
    expect(claim.rendered).toBe('E1');
  });
});
