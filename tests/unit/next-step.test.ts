/**
 * Actionable diagnostics.
 *
 * A cap that does not name the missing artifact leaves the author to
 * reverse-engineer the ladder from §4.3. Applying the standard to a real
 * repository made the cost concrete: a project with a genuine eval suite and
 * dated baselines could not reach E3 because it had never recorded a
 * `golden_set_sha`, and nothing anywhere told it so.
 */

import { describe, expect, it } from 'vitest';
import { EMPTY_SUPPORT, nextStep, resolveClaim, type SupportContext } from '../../src/resolve/index.js';
import type { Claim } from '../../src/model.js';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

const claim = (over: Partial<Claim> = {}): Claim => ({
  path: 'docs/product/results/x.md',
  signal: 'S7',
  declared: 'E3',
  visibility: 'public',
  n: 130,
  date: '2026-09-14',
  goldenSetSha: undefined,
  retrospective: false,
  anchor: undefined,
  provenance: undefined,
  ...over,
});

const support = (over: Partial<SupportContext> = {}): SupportContext => ({
  ...EMPTY_SUPPORT,
  ...over,
});

describe('guidance toward E2', () => {
  it('names the discovery synthesis and where to declare it', () => {
    const step = nextStep(claim(), support(), 'E1');
    expect(step).toContain('discovery synthesis');
    expect(step).toContain('evidence.discovery');
  });

  it('asks for n when the synthesis exists but the claim has none', () => {
    const step = nextStep(claim({ n: undefined }), support({ hasDiscoverySynthesis: true }), 'E1');
    expect(step).toContain('state n');
  });
});

describe('guidance toward E3', () => {
  const withDiscovery = { hasDiscoverySynthesis: true };

  it('says the golden set need not be JSONL', () => {
    // The failure this exists to prevent: an author with a real eval suite in
    // an unexpected location concluding their evidence does not count.
    const step = nextStep(claim(), support(withDiscovery), 'E2');
    expect(step).toContain('evidence.goldenSet');
    expect(step).toContain('need not be JSONL');
  });

  it('names the hash command when the baseline has no sha', () => {
    const step = nextStep(claim(), support({ ...withDiscovery, hasGoldenSet: true }), 'E2');
    expect(step).toContain('golden_set_sha');
    expect(step).toContain('preview hash');
  });

  it('names the hash command when the result has no sha', () => {
    const step = nextStep(
      claim({ goldenSetSha: undefined }),
      support({ ...withDiscovery, hasGoldenSet: true, baselineSha: SHA_A }),
      'E2',
    );
    expect(step).toContain('preview hash');
  });

  it('explains a hash mismatch as a meaningless comparison, not a mistake to hide', () => {
    const step = nextStep(
      claim({ goldenSetSha: SHA_B }),
      support({ ...withDiscovery, hasGoldenSet: true, baselineSha: SHA_A }),
      'E2',
    );
    expect(step).toContain('changed between the baseline and this result');
    expect(step).toContain('new baseline');
  });
});

describe('guidance at the ceiling', () => {
  it('states plainly that E4 requires a market', () => {
    const step = nextStep(claim(), support(), 'E3');
    expect(step).toContain('requires instrumented usage');
    expect(step).toContain('ceiling without users');
  });
});

describe('guidance never suggests overclaiming', () => {
  it('never tells the author to raise their declaration', () => {
    const tiers = ['E1', 'E2', 'E3', 'E4'] as const;
    for (const supported of tiers) {
      const step = nextStep(claim(), support(), supported);
      expect(step.toLowerCase()).not.toContain('declare a higher');
      expect(step.toLowerCase()).not.toContain('change the tier');
    }
  });
});

describe('integration with the resolver', () => {
  it('attaches guidance to the overclaim diagnostic', () => {
    const { diagnostics } = resolveClaim(claim({ declared: 'E3' }), EMPTY_SUPPORT);
    const overclaim = diagnostics.find((d) => d.code === 'tier-overclaim');
    expect(overclaim?.message).toContain('To reach E2');
  });

  it('emits no guidance when nothing is capped', () => {
    const honest = claim({ declared: 'E1' });
    const { diagnostics } = resolveClaim(honest, EMPTY_SUPPORT);
    expect(diagnostics.some((d) => d.code === 'tier-overclaim')).toBe(false);
  });
});
