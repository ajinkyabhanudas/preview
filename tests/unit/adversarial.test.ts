/**
 * Adversarial fixture assertions.
 *
 * Every vector in tests/fixtures/adversarial/README.md must be in exactly one
 * of two states: CAUGHT by a mechanical check, or UNENFORCED and declared as
 * such in spec/standard-v0.1.md §9.
 *
 * The second half matters as much as the first. Without it, a vector can drift
 * from "we publicly cannot check this" to "we forgot about this" with nothing
 * failing.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ingest, isInsideRoot } from '../../src/ingest/index.js';
import { filterByVisibility, scanVisibility } from '../../src/filter/index.js';
import { parseTier } from '../../src/tier.js';
import { parseVisibility } from '../../src/model.js';
import { EMPTY_SUPPORT, resolveClaim, supportedTier, type SupportContext } from '../../src/resolve/index.js';
import type { Claim } from '../../src/model.js';

const FIXTURE = join(process.cwd(), 'tests/fixtures/adversarial');
const STANDARD = readFileSync(join(process.cwd(), 'spec/standard-v0.1.md'), 'utf8');

const claim = (over: Partial<Claim>): Claim => ({
  path: 'docs/product/x.md',
  signal: 'S7',
  declared: 'E1',
  visibility: 'public',
  n: undefined,
  date: undefined,
  goldenSetSha: undefined,
  retrospective: false,
  anchor: undefined,
  provenance: undefined,
  ...over,
});

describe('V1 — overclaim with no supporting artifacts', () => {
  it('renders at E1, not the declared E5', () => {
    const { claim: r } = resolveClaim(claim({ declared: 'E5', n: 3 }), EMPTY_SUPPORT);
    expect(r.rendered).toBe('E1');
    expect(r.declared).toBe('E5');
  });

  it('warns that the declaration exceeded support', () => {
    const { diagnostics } = resolveClaim(claim({ declared: 'E5' }), EMPTY_SUPPORT);
    expect(diagnostics.some((d) => d.code === 'tier-overclaim')).toBe(true);
  });
});

describe('V2 — golden set edited between baseline and result', () => {
  const ctx: SupportContext = {
    hasDiscoverySynthesis: true,
    hasGoldenSet: true,
    baselineSha: 'a'.repeat(64),
    hasInstrumentation: false,
    hasComparisonSpec: false,
  };

  it('caps at E2 when the result hash differs from the baseline', () => {
    const tampered = claim({ declared: 'E3', n: 120, goldenSetSha: 'b'.repeat(64) });
    expect(supportedTier(tampered, ctx)).toBe('E2');
  });

  it('raises an error-severity diagnostic, not a quiet warning', () => {
    const tampered = claim({ declared: 'E3', n: 120, goldenSetSha: 'b'.repeat(64) });
    const { diagnostics } = resolveClaim(tampered, ctx);
    const hit = diagnostics.find((d) => d.code === 'golden-set-hash-mismatch');
    expect(hit?.severity).toBe('error');
  });
});

describe('V3 — backdated decision with no anchor', () => {
  it('caps at E0', () => {
    const backdated = claim({ signal: 'S6', declared: 'E1', retrospective: true });
    const { claim: r } = resolveClaim(backdated, EMPTY_SUPPORT);
    expect(r.rendered).toBe('E0');
  });

  it('applies to judgment signals too', () => {
    const j = claim({ signal: 'J4', declared: 'E1', retrospective: true });
    expect(resolveClaim(j, EMPTY_SUPPORT).claim.rendered).toBe('E0');
  });
});

describe('V8 — malformed front matter cannot grant a tier', () => {
  it('floors any unparseable tier value to E0', () => {
    for (const bad of ['[E5, not-a-tier', undefined, null, 'E5 ', {}, ['E5']]) {
      expect(parseTier(bad)).toBe('E0');
    }
  });
});

describe('V9 — path traversal via config', () => {
  it('rejects a path escaping the repository root', () => {
    expect(isInsideRoot('/repo', '/repo/../etc/passwd')).toBe(false);
    expect(isInsideRoot('/repo', '/etc/passwd')).toBe(false);
  });

  it('rejects a sibling directory sharing a name prefix', () => {
    expect(isInsideRoot('/repo', '/repo-evil/secrets')).toBe(false);
  });

  it('accepts a legitimate path inside the root', () => {
    expect(isInsideRoot('/repo', '/repo/docs/product/a.md')).toBe(true);
  });

  it('ingests the fixture without reading outside it', async () => {
    const { snapshot } = await ingest(FIXTURE);
    for (const file of snapshot.files) {
      expect(file.path.startsWith('..')).toBe(false);
      expect(file.path).not.toContain('etc/passwd');
    }
  });
});

describe('V10 — mislabelled visibility must not publish', () => {
  it('floors an unrecognised visibility value to private', () => {
    expect(parseVisibility('pubic')).toBe('private');
    expect(parseVisibility('Public')).toBe('private');
    expect(parseVisibility(undefined)).toBe('private');
  });

  it('drops the typo file at the filter stage', () => {
    const content = readFileSync(join(FIXTURE, 'docs/product/typo-visibility.md'), 'utf8');
    expect(scanVisibility(content)).toBe('private');

    const { kept, dropped } = filterByVisibility([{ path: 'typo.md', content }]);
    expect(kept).toHaveLength(0);
    expect(dropped[0]?.path).toBe('typo.md');
  });

  it('treats unterminated front matter as private', () => {
    expect(scanVisibility('---\nsignal: S7\nvisibility: public\n')).toBe('private');
  });
});

describe('UNENFORCED vectors are declared in the standard', () => {
  /**
   * Each of these is a vector the standard cannot mechanically defeat. The
   * assertion is that §9 still says so publicly — not that the vector is
   * caught. If someone deletes a row from the verification boundary table,
   * this fails.
   */
  const declared: readonly [string, string][] = [
    ['V5 fabricated interviews', 'Interview transcripts describe real conversations'],
    ['V6 typed numbers', 'Reported numbers came from the run they claim'],
    ['V7 unrepresentative golden set', 'The golden set represents real inputs'],
  ];

  for (const [vector, row] of declared) {
    it(`${vector} is listed as unverified in §9`, () => {
      expect(STANDARD).toContain(row);
    });
  }

  it('§9 states the tier means artifacts exist, not that claims are true', () => {
    expect(STANDARD).toContain('The work was any good');
  });
});
