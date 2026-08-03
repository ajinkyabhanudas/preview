/**
 * Property tests for the capping rule.
 *
 * spec/build-v1.md §5.1 requires these as *property* tests over generated
 * input rather than example tests. The reason is specific: an example test
 * proves the cases someone thought of, and the failure mode that matters here
 * is the case nobody thought of granting a tier that was never earned.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { TIERS, isAtLeast, isOverclaim, isTier, minTier, parseTier, type Tier } from '../../src/tier.js';

const anyTier = (): fc.Arbitrary<Tier> => fc.constantFrom(...TIERS);

describe('tier ordering', () => {
  it('is total over all 36 ordered pairs', () => {
    for (const a of TIERS) {
      for (const b of TIERS) {
        const m = minTier(a, b);
        expect(m === a || m === b).toBe(true);
      }
    }
  });

  it('is commutative', () => {
    fc.assert(
      fc.property(anyTier(), anyTier(), (a, b) => {
        expect(minTier(a, b)).toBe(minTier(b, a));
      }),
    );
  });

  it('is associative', () => {
    fc.assert(
      fc.property(anyTier(), anyTier(), anyTier(), (a, b, c) => {
        expect(minTier(minTier(a, b), c)).toBe(minTier(a, minTier(b, c)));
      }),
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(anyTier(), (a) => {
        expect(minTier(a, a)).toBe(a);
      }),
    );
  });
});

describe('PROPERTY 1 — rendered tier never exceeds declared tier', () => {
  it('holds for every declared/supported pair', () => {
    fc.assert(
      fc.property(anyTier(), anyTier(), (declared, supported) => {
        const rendered = minTier(declared, supported);
        expect(isAtLeast(declared, rendered)).toBe(true);
      }),
    );
  });
});

describe('PROPERTY 2 — rendered tier never exceeds supported tier', () => {
  it('holds for every declared/supported pair', () => {
    fc.assert(
      fc.property(anyTier(), anyTier(), (declared, supported) => {
        const rendered = minTier(declared, supported);
        expect(isAtLeast(supported, rendered)).toBe(true);
      }),
    );
  });

  it('never silently upgrades: an overclaim always renders at supported', () => {
    fc.assert(
      fc.property(anyTier(), anyTier(), (declared, supported) => {
        if (isOverclaim(declared, supported)) {
          expect(minTier(declared, supported)).toBe(supported);
        }
      }),
    );
  });
});

describe('PROPERTY 3 — monotonicity', () => {
  /**
   * Adding an artifact to a repository must never *lower* a rendered tier.
   *
   * Modelled here at the algebraic level: raising the supported tier (what
   * adding an artifact does) can only raise or hold the rendered tier. The
   * repository-level version of this property lives in the resolver tests once
   * B4 lands — this is the algebraic precondition for it.
   */
  it('raising supported never lowers rendered', () => {
    fc.assert(
      fc.property(anyTier(), anyTier(), anyTier(), (declared, before, after) => {
        fc.pre(isAtLeast(after, before));
        const renderedBefore = minTier(declared, before);
        const renderedAfter = minTier(declared, after);
        expect(isAtLeast(renderedAfter, renderedBefore)).toBe(true);
      }),
    );
  });
});

describe('parseTier — untrusted input', () => {
  it('returns a tier on the ladder for absolutely any input', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        expect(isTier(parseTier(value))).toBe(true);
      }),
    );
  });

  it('floors to E0 rather than throwing or passing through', () => {
    for (const bad of [undefined, null, '', 'E6', 'e3', 'E-1', 3, {}, [], 'DROP TABLE']) {
      expect(parseTier(bad)).toBe('E0');
    }
  });

  it('preserves valid declarations exactly', () => {
    fc.assert(
      fc.property(anyTier(), (t) => {
        expect(parseTier(t)).toBe(t);
      }),
    );
  });
});
