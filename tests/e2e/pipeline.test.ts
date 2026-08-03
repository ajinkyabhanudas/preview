/**
 * End-to-end pipeline tests — spec/build-v1.md §5.4.
 *
 * Runs ingest -> filter -> validate -> resolve over real fixture repositories
 * on disk. Everything up to here has been tested in isolation; this is the
 * first test that proves the stages compose.
 */

import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { analyse } from '../../src/index.js';

const FIXTURES = join(process.cwd(), 'tests/fixtures');
const CLOCK = new Date('2026-09-14T00:00:00.000Z');

const run = (name: string) => analyse(join(FIXTURES, name), { clock: CLOCK });

describe('honest-complete', () => {
  it('resolves every declared claim at its declared tier', async () => {
    const report = await run('honest-complete');
    for (const claim of report.claims) {
      expect(claim.rendered).toBe(claim.declared);
    }
  });

  it('supports E3 because the baseline and result hashes match', async () => {
    const report = await run('honest-complete');
    const result = report.claims.find((c) => c.signal === 'S7');
    expect(result?.rendered).toBe('E3');
  });

  it('supports E2 for the discovery synthesis', async () => {
    const report = await run('honest-complete');
    expect(report.claims.find((c) => c.signal === 'S2')?.rendered).toBe('E2');
  });

  it('emits no overclaim or error diagnostics', async () => {
    const report = await run('honest-complete');
    const bad = report.diagnostics.filter(
      (d) => d.severity === 'error' || d.code === 'tier-overclaim',
    );
    expect(bad).toEqual([]);
  });

  it('is deterministic — two runs produce identical output', async () => {
    const a = await run('honest-complete');
    const b = await run('honest-complete');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('uses the injected clock, not the system clock', async () => {
    const report = await run('honest-complete');
    expect(report.builtAt).toBe('2026-09-14T00:00:00.000Z');
  });
});

describe('adversarial', () => {
  it('renders the E5 overclaim down to E1', async () => {
    const report = await run('adversarial');
    const overclaim = report.claims.find((c) => c.path.endsWith('overclaim.md'));
    expect(overclaim?.declared).toBe('E5');
    expect(overclaim?.rendered).toBe('E1');
  });

  it('never renders any claim above what the repository supports', async () => {
    const report = await run('adversarial');
    for (const claim of report.claims) {
      expect(claim.rendered <= claim.supported || claim.rendered === claim.supported).toBe(true);
    }
  });

  it('drops the mislabelled-visibility file before it can be published', async () => {
    const report = await run('adversarial');
    expect(report.droppedPrivate).toContain('docs/product/typo-visibility.md');
    expect(report.claims.some((c) => c.path.endsWith('typo-visibility.md'))).toBe(false);
  });

  it('caps the unanchored backdated decision at E0', async () => {
    const report = await run('adversarial');
    const backdated = report.claims.find((c) => c.path.endsWith('0002-backdated.md'));
    expect(backdated?.rendered).toBe('E0');
  });

  it('reports the malformed front matter without crashing', async () => {
    const report = await run('adversarial');
    expect(report.diagnostics.some((d) => d.code === 'malformed-front-matter')).toBe(true);
  });

  it('never reads outside the repository root despite the config traversal', async () => {
    const report = await run('adversarial');
    for (const claim of report.claims) {
      expect(claim.path.startsWith('..')).toBe(false);
      expect(claim.path).not.toContain('etc');
    }
  });
});

describe('missing repository', () => {
  it('returns an empty report rather than throwing', async () => {
    const report = await analyse(join(FIXTURES, 'does-not-exist'), { clock: CLOCK });
    expect(report.claims).toEqual([]);
  });
});
