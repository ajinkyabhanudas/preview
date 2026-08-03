/**
 * Validation tests — spec/build-v1.md §3.3.
 *
 * The governing rule under test: a field that cannot be read confidently is
 * absent, and absence always costs tier rather than granting it.
 */

import { describe, expect, it } from 'vitest';
import { parseDocument, splitFrontMatter } from '../../src/validate/frontmatter.js';
import { buildSupportContext, validateDocument } from '../../src/validate/schema.js';
import type { ParsedDocument, SourceFile } from '../../src/model.js';

const file = (content: string, path = 'docs/product/x.md'): SourceFile => ({ path, content });

const doc = (frontMatter: Record<string, unknown>, path = 'docs/product/x.md'): ParsedDocument => ({
  path,
  frontMatter,
  body: '',
});

describe('splitFrontMatter', () => {
  it('separates front matter from body', () => {
    const { raw, body } = splitFrontMatter('---\nsignal: S7\n---\n# Title\n');
    expect(raw).toContain('signal: S7');
    expect(body).toBe('# Title\n');
  });

  it('treats a file with no front matter as all body', () => {
    const { raw, body } = splitFrontMatter('# Just prose\n');
    expect(raw).toBeUndefined();
    expect(body).toBe('# Just prose\n');
  });

  it('refuses to guess where unterminated front matter ends', () => {
    // Guessing would let a partial block declare a tier.
    const { raw } = splitFrontMatter('---\nsignal: S7\ntier: E5\n');
    expect(raw).toBeUndefined();
  });
});

describe('parseDocument — never throws', () => {
  it('degrades malformed YAML to empty front matter with a diagnostic', () => {
    const { document, diagnostics } = parseDocument(file('---\ntier: [E5, unclosed\n---\n'));
    expect(document.frontMatter).toEqual({});
    expect(diagnostics.some((d) => d.code === 'malformed-front-matter')).toBe(true);
  });

  it('rejects front matter that is not a mapping', () => {
    const { document, diagnostics } = parseDocument(file('---\n- E5\n- E4\n---\n'));
    expect(document.frontMatter).toEqual({});
    expect(diagnostics.some((d) => d.code === 'front-matter-not-a-mapping')).toBe(true);
  });

  it('bounds pathological front matter size', () => {
    const huge = `---\n${'x: y\n'.repeat(20_000)}---\n`;
    const { document, diagnostics } = parseDocument(file(huge));
    expect(document.frontMatter).toEqual({});
    expect(diagnostics.some((d) => d.code === 'front-matter-too-large')).toBe(true);
  });

  it('parses valid front matter', () => {
    const { document } = parseDocument(file('---\nsignal: S7\ntier: E3\nn: 120\n---\nbody\n'));
    expect(document.frontMatter['signal']).toBe('S7');
    expect(document.frontMatter['n']).toBe(120);
  });
});

describe('validateDocument — no coercion toward a higher tier', () => {
  it('treats a non-numeric n as absent', () => {
    const { claim, diagnostics } = validateDocument(doc({ signal: 'S7', tier: 'E3', n: 'many' }));
    expect(claim?.n).toBeUndefined();
    expect(diagnostics.some((d) => d.code === 'unreadable-n')).toBe(true);
  });

  it('rejects zero and negative n', () => {
    expect(validateDocument(doc({ signal: 'S7', n: 0 })).claim?.n).toBeUndefined();
    expect(validateDocument(doc({ signal: 'S7', n: -5 })).claim?.n).toBeUndefined();
  });

  it('rejects a non-integer n', () => {
    expect(validateDocument(doc({ signal: 'S7', n: 12.5 })).claim?.n).toBeUndefined();
  });

  it('floors an unreadable tier to E0 and says so', () => {
    const { claim, diagnostics } = validateDocument(doc({ signal: 'S7', tier: 'E9' }));
    expect(claim?.declared).toBe('E0');
    expect(diagnostics.some((d) => d.code === 'unreadable-tier')).toBe(true);
  });

  it('rejects an impossible calendar date', () => {
    expect(validateDocument(doc({ signal: 'S7', date: '2026-02-30' })).claim?.date).toBeUndefined();
    expect(validateDocument(doc({ signal: 'S7', date: '14/09/2026' })).claim?.date).toBeUndefined();
  });

  it('accepts a real date', () => {
    expect(validateDocument(doc({ signal: 'S7', date: '2026-09-14' })).claim?.date).toBe('2026-09-14');
  });

  it('rejects a non-hex golden set sha', () => {
    expect(validateDocument(doc({ signal: 'S7', golden_set_sha: 'not-a-hash!' })).claim?.goldenSetSha)
      .toBeUndefined();
  });

  it('normalises a valid sha to lowercase', () => {
    const { claim } = validateDocument(doc({ signal: 'S7', golden_set_sha: 'A'.repeat(64) }));
    expect(claim?.goldenSetSha).toBe('a'.repeat(64));
  });
});

describe('validateDocument — retrospective defaults to true', () => {
  /**
   * The inverted default. An unlabelled reconstruction is the failure §6 exists
   * to prevent; a wrongly-flagged file costs the author seconds to correct.
   */
  it('defaults to true when the field is absent', () => {
    expect(validateDocument(doc({ signal: 'S6' })).claim?.retrospective).toBe(true);
  });

  it('defaults to true when the field is unreadable', () => {
    expect(validateDocument(doc({ signal: 'S6', retrospective: 'no' })).claim?.retrospective).toBe(true);
  });

  it('honours an explicit false', () => {
    expect(validateDocument(doc({ signal: 'S6', retrospective: false })).claim?.retrospective).toBe(false);
  });
});

describe('validateDocument — signals', () => {
  it('produces no claim for a document with no signal', () => {
    expect(validateDocument(doc({ tier: 'E5' })).claim).toBeUndefined();
  });

  it('warns on an unrecognised signal rather than accepting it', () => {
    const { claim, diagnostics } = validateDocument(doc({ signal: 'S99', tier: 'E5' }));
    expect(claim).toBeUndefined();
    expect(diagnostics.some((d) => d.code === 'unknown-signal')).toBe(true);
  });

  it('accepts judgment signals', () => {
    expect(validateDocument(doc({ signal: 'J4', tier: 'E1' })).claim?.signal).toBe('J4');
  });
});

describe('validateDocument — visibility fails safe', () => {
  it('defaults an unrecognised value to private with an error', () => {
    const { claim, diagnostics } = validateDocument(doc({ signal: 'S6', visibility: 'pubic' }));
    expect(claim?.visibility).toBe('private');
    expect(diagnostics.some((d) => d.code === 'unreadable-visibility')).toBe(true);
  });
});

describe('diagnostics describe nested values usefully', () => {
  /**
   * Front matter is arbitrary YAML, so a field can hold a map or list. A
   * diagnostic saying `tier "[object Object]" is not on the ladder` tells the
   * author nothing about what they wrote.
   */
  it('shows the shape of a nested tier value', () => {
    const { diagnostics } = validateDocument(doc({ signal: 'S7', tier: { min: 'E3' } }));
    const hit = diagnostics.find((d) => d.code === 'unreadable-tier');
    expect(hit?.message).toContain('{"min":"E3"}');
    expect(hit?.message).not.toContain('[object Object]');
  });

  it('shows the shape of a list-valued n', () => {
    const { diagnostics } = validateDocument(doc({ signal: 'S7', n: [1, 2] }));
    expect(diagnostics.find((d) => d.code === 'unreadable-n')?.message).toContain('[1,2]');
  });

  it('bounds a pathologically large value', () => {
    const { diagnostics } = validateDocument(doc({ signal: 'S7', tier: 'x'.repeat(5000) }));
    const message = diagnostics.find((d) => d.code === 'unreadable-tier')?.message ?? '';
    expect(message.length).toBeLessThan(300);
  });
});

describe('buildSupportContext — derived from files, never declarations', () => {
  it('reports no support for an empty repository', () => {
    const ctx = buildSupportContext([], []);
    expect(ctx.hasDiscoverySynthesis).toBe(false);
    expect(ctx.hasGoldenSet).toBe(false);
    expect(ctx.baselineSha).toBeUndefined();
  });

  it('requires all four fields for a discovery synthesis to count', () => {
    const partial = doc(
      { n: 9, method: 'interview', segment: 'postgrads' },
      'docs/product/discovery/synthesis.md',
    );
    expect(buildSupportContext([partial], []).hasDiscoverySynthesis).toBe(false);

    const complete = doc(
      { n: 9, method: 'interview', segment: 'postgrads', recruitment: 'alumni network' },
      'docs/product/discovery/synthesis.md',
    );
    expect(buildSupportContext([complete], []).hasDiscoverySynthesis).toBe(true);
  });

  it('does not count an empty golden set file', () => {
    const empty: ParsedDocument = { path: 'evals/golden/v1.jsonl', frontMatter: {}, body: '   \n' };
    expect(buildSupportContext([empty], []).hasGoldenSet).toBe(false);
  });

  it('counts a non-empty golden set', () => {
    const set: ParsedDocument = { path: 'evals/golden/v1.jsonl', frontMatter: {}, body: '{"q":1}\n' };
    expect(buildSupportContext([set], []).hasGoldenSet).toBe(true);
  });

  it('reads the baseline sha from the baseline record', () => {
    const baseline = doc({ golden_set_sha: 'a'.repeat(64) }, 'evals/baseline-2026-09-01.md');
    expect(buildSupportContext([baseline], []).baselineSha).toBe('a'.repeat(64));
  });

  it('ignores an unreadable baseline sha rather than trusting it', () => {
    const baseline = doc({ golden_set_sha: 'v2' }, 'evals/baseline-2026-09-01.md');
    expect(buildSupportContext([baseline], []).baselineSha).toBeUndefined();
  });
});
