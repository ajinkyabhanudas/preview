/**
 * Render tests — spec/standard-v0.1.md §8.
 *
 * These assert product rules, not appearance. Each one is a requirement a
 * styling change must not be able to quietly reverse.
 */

import { describe, expect, it } from 'vitest';
import {
  direction,
  escapeText,
  formatValue,
  renderBarChart,
  renderResultFigure,
  renderSeriesTable,
  slugify,
  type Series,
} from '../../src/render/chart.js';
import {
  renderAbsent,
  renderJudgmentSection,
  renderProvenance,
  renderTierBadge,
  renderVerificationBoundary,
} from '../../src/render/page.js';
import { absentSignals, headlineClaim, renderDocument } from '../../src/render/document.js';
import type { ResolvedClaim } from '../../src/model.js';

const claim = (over: Partial<ResolvedClaim> = {}): ResolvedClaim => ({
  path: 'docs/product/x.md',
  signal: 'S7',
  declared: 'E3',
  supported: 'E3',
  rendered: 'E3',
  visibility: 'public',
  n: 120,
  date: '2026-09-14',
  goldenSetSha: 'a'.repeat(64),
  retrospective: false,
  anchor: undefined,
  provenance: 'frozen golden set v1',
  ...over,
});

const series: readonly Series[] = [
  { label: 'faithfulness', baseline: 58, current: 79 },
  { label: 'refusal', baseline: 80, current: 62 },
  { label: 'formatting', baseline: 90, current: 90 },
];

describe('determinism (D1)', () => {
  it('renders byte-identical output for identical input', () => {
    const a = renderBarChart(series, { title: 'Pass rate', unit: '%' });
    const b = renderBarChart(series, { title: 'Pass rate', unit: '%' });
    expect(a).toBe(b);
  });

  it('derives identifiers from content, not counters', () => {
    const first = renderBarChart(series, { title: 'Pass rate' });
    const second = renderBarChart(series, { title: 'Pass rate' });
    expect(first).toContain('chart-pass-rate');
    expect(first).toBe(second);
  });

  it('formats numbers without locale, which is an environment read', () => {
    expect(formatValue(1234.56)).toBe('1234.6');
    expect(formatValue(50, '%')).toBe('50%');
    expect(formatValue(0.1 + 0.2)).toBe('0.3');
  });
});

describe('§8.2 — regressions carry equal visual weight', () => {
  /**
   * The rule is structural: a regression must not be smaller, quieter, or
   * collapsed. Direction is carried by a data attribute and colour, never by
   * geometry or opacity, so a stylesheet cannot shrink one direction.
   */
  it('gives improved and regressed bars identical geometry', () => {
    const improved = renderBarChart([{ label: 'a', baseline: 10, current: 90 }], { title: 't' });
    const regressed = renderBarChart([{ label: 'a', baseline: 90, current: 10 }], { title: 't' });

    const heightOf = (svg: string) => [...svg.matchAll(/height="(\d+)"/g)].map((m) => m[1]);
    expect(heightOf(improved)).toEqual(heightOf(regressed));
  });

  it('never applies opacity to a current-value bar', () => {
    const svg = renderBarChart([{ label: 'a', baseline: 90, current: 10 }], { title: 't' });
    expect(svg).not.toMatch(/bar-current[^>]*opacity/);
  });

  it('marks direction as data, so it is styleable but not hideable', () => {
    const svg = renderBarChart(series, { title: 't' });
    expect(svg).toContain('data-direction="improved"');
    expect(svg).toContain('data-direction="regressed"');
    expect(svg).toContain('data-direction="none"');
  });

  it('states direction in words, so colour is never the sole indicator', () => {
    const table = renderSeriesTable(series, { title: 't', unit: '%' });
    expect(table).toContain('regressed');
    expect(table).toContain('improved');
    expect(table).toContain('unchanged');
  });
});

describe('§8.4 — charts degrade to text', () => {
  it('emits a table alongside every chart', () => {
    const figure = renderResultFigure(series, { title: 'Pass rate', unit: '%' });
    expect(figure).toContain('<svg');
    expect(figure).toContain('<table');
  });

  it('puts every value in the table, not only in the chart', () => {
    const table = renderSeriesTable(series, { title: 't', unit: '%' });
    for (const s of series) {
      expect(table).toContain(s.label);
      expect(table).toContain(String(s.baseline));
    }
  });
});

describe('§8.3 — tier and n render together', () => {
  it('never separates n from its tier', () => {
    const badge = renderTierBadge(claim({ n: 120 }));
    expect(badge).toContain('E3');
    expect(badge).toContain('n=120');
  });

  it('shows a capped marker when the declaration exceeded support', () => {
    const badge = renderTierBadge(claim({ declared: 'E5', supported: 'E1', rendered: 'E1' }));
    expect(badge).toContain('capped');
    expect(badge).toContain('E1');
  });

  it('renders the date next to the metric', () => {
    expect(renderProvenance(claim())).toContain('2026-09-14');
  });

  it('flags an unanchored reconstruction distinctly from an anchored one', () => {
    const unanchored = renderProvenance(claim({ retrospective: true }));
    const anchored = renderProvenance(claim({ retrospective: true, anchor: 'commit 9f2c1a' }));
    expect(unanchored).toContain('no anchor');
    expect(anchored).toContain('anchored');
    expect(anchored).not.toContain('no anchor');
  });
});

describe('§9 — the verification boundary is in the output', () => {
  it('reproduces the boundary table, not only a link to it', () => {
    const html = renderVerificationBoundary();
    expect(html).toContain('Interviews describe real conversations');
    expect(html).toContain('Reported numbers came from the run they claim');
    expect(html).toContain('The work was any good');
  });

  it('states that a tier means artifacts exist, not that a claim is true', () => {
    expect(renderVerificationBoundary()).toContain('never means the claim is true');
  });
});

describe('§8.3 — judgment signals are separated and labelled', () => {
  it('states the honour-system nature in the output itself', () => {
    const html = renderJudgmentSection([claim({ signal: 'J4', path: 'docs/product/j.md' })]);
    expect(html).toContain('honour-system');
    expect(html).toContain('names a live alternative and an accepted cost');
  });

  it('renders nothing when there are no judgment claims', () => {
    expect(renderJudgmentSection([claim({ signal: 'S7' })])).toBe('');
  });
});

describe('§3.3 — absent signals are shown, not hidden', () => {
  it('lists evidence signals with no claim behind them', () => {
    const absent = absentSignals([claim({ signal: 'S7' })]);
    expect(absent).toContain('S1');
    expect(absent).toContain('S2');
    expect(absent).not.toContain('S7');
  });

  it('explains why absent signals appear at all', () => {
    const html = renderAbsent(['S2']);
    expect(html).toContain('omitting them would misrepresent');
  });
});

describe('headline selection', () => {
  /**
   * Chosen on rendered tier, never declared. Choosing on declaration would let
   * an overclaim decide what a reviewer sees first — inverting the capping rule
   * at the moment it matters most.
   */
  it('picks the highest rendered tier, not the highest declared', () => {
    const overclaim = claim({ path: 'a.md', declared: 'E5', supported: 'E0', rendered: 'E0' });
    const honest = claim({ path: 'b.md', declared: 'E3', supported: 'E3', rendered: 'E3' });
    expect(headlineClaim([overclaim, honest])?.path).toBe('b.md');
  });

  it('breaks ties deterministically', () => {
    const a = claim({ path: 'a.md' });
    const b = claim({ path: 'b.md' });
    expect(headlineClaim([b, a])?.path).toBe('a.md');
    expect(headlineClaim([a, b])?.path).toBe('a.md');
  });
});

describe('escaping', () => {
  it('escapes markup in labels', () => {
    expect(escapeText('<script>alert(1)</script>')).not.toContain('<script>');
  });

  it('escapes a hostile series label inside SVG', () => {
    const svg = renderBarChart([{ label: '</text><script>x</script>', baseline: 1, current: 2 }], {
      title: 't',
    });
    expect(svg).not.toContain('<script>');
  });
});

describe('the front door (§8.1)', () => {
  const front = {
    title: 'Canopy',
    problem: 'The science team cannot query the database without an engineer.',
    decision: 'Read-only SQL generation over a fine-tuned model.',
    gotWrong: 'The first taxonomy was derived from imagined failures, not real outputs.',
  };

  it('carries all four required elements', () => {
    const html = renderDocument(front, [claim()], '2026-09-14T00:00:00.000Z');
    expect(html).toContain(front.problem);
    expect(html).toContain(front.decision);
    expect(html).toContain(front.gotWrong);
    expect(html).toContain('E3');
  });

  it('is self-contained — no external requests', () => {
    const html = renderDocument(front, [claim()], '2026-09-14T00:00:00.000Z');
    expect(html).not.toMatch(/<script\s+src=/);
    expect(html).not.toMatch(/<link[^>]+href="https?:/);
  });

  it('renders identically for identical input', () => {
    const a = renderDocument(front, [claim()], '2026-09-14T00:00:00.000Z');
    const b = renderDocument(front, [claim()], '2026-09-14T00:00:00.000Z');
    expect(a).toBe(b);
  });

  it('styles both colour schemes', () => {
    const html = renderDocument(front, [claim()], '2026-09-14T00:00:00.000Z');
    expect(html).toContain('prefers-color-scheme: dark');
  });
});

describe('helpers', () => {
  it('classifies direction', () => {
    expect(direction({ label: 'a', baseline: 1, current: 2 })).toBe('improved');
    expect(direction({ label: 'a', baseline: 2, current: 1 })).toBe('regressed');
    expect(direction({ label: 'a', baseline: 2, current: 2 })).toBe('none');
  });

  it('slugifies without collisions from punctuation', () => {
    expect(slugify('Pass rate (%)')).toBe('pass-rate');
  });

  it('handles an all-zero series without producing NaN', () => {
    const svg = renderBarChart([{ label: 'a', baseline: 0, current: 0 }], { title: 't' });
    expect(svg).not.toContain('NaN');
  });

  it('renders nothing for an empty series', () => {
    expect(renderBarChart([], { title: 't' })).toBe('');
    expect(renderResultFigure([], { title: 't' })).toBe('');
  });
});
