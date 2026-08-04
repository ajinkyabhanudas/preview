/**
 * Extraction tests — DECISIONS.md D11.
 *
 * The property under test is honesty, not coverage. A draft that invents a
 * plausible value is worse than no draft, because an author may accept it
 * without reading.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extract, renderDraft, hashGoldenSet } from '../../src/author/extract.js';

let repo: string;
let docs: string;

beforeAll(async () => {
  repo = await mkdtemp(join(tmpdir(), 'preview-repo-'));
  docs = await mkdtemp(join(tmpdir(), 'preview-docs-'));

  await writeFile(join(repo, 'DECISIONS.md'), '# Decisions\n\n## D1 — A choice\n\n## D2 — Another\n');
  await writeFile(join(repo, 'LIMITATIONS.md'), '# Limits\n\n## Known gaps\n');
  await mkdir(join(repo, 'benchmark_results'), { recursive: true });
  await writeFile(
    join(repo, 'benchmark_results/benchmark_20260728T040642.json'),
    JSON.stringify({ run_at: '2026-07-28T04:06:42Z', cases: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
  );

  await writeFile(join(docs, '01-PRD.md'), '# PRD\n\n## Not building\n\nA hosted platform.\n');
  await writeFile(join(docs, '00-discovery-interview.md'), '# Interview\n\nQ: ...\n');
  await writeFile(join(docs, '04-retrospective.md'), '# Retro\n\n## Section A\n\n## Section B\n');
});

afterAll(async () => {
  await rm(repo, { recursive: true, force: true });
  await rm(docs, { recursive: true, force: true });
});

describe('extraction from a code repository', () => {
  it('proposes S6 from a decisions file', async () => {
    const report = await extract(repo);
    expect(report.drafts.some((d) => d.signal === 'S6')).toBe(true);
  });

  it('reads real values from a benchmark file rather than inventing them', async () => {
    const report = await extract(repo);
    const results = report.drafts.find((d) => d.signal === 'S7');
    expect(results?.fields['date']?.value).toBe('2026-07-28');
    expect(results?.fields['n']?.value).toBe(3);
  });

  it('reports signals with no evidence as missing, never fabricating them', async () => {
    const report = await extract(repo);
    expect(report.missing).toContain('S3');
    expect(report.missing).toContain('S4');
    expect(report.drafts.some((d) => d.signal === 'S3')).toBe(false);
  });
});

describe('extraction from a product-documentation folder', () => {
  /**
   * The signals hardest to evidence live outside the code repository. An
   * extractor that only reads the repo reports them missing when they exist.
   */
  it('finds S1 and S2 in docs that are not in the code repository', async () => {
    const withoutDocs = await extract(repo);
    expect(withoutDocs.missing).toContain('S2');

    const withDocs = await extract(repo, { docsRoot: docs });
    expect(withDocs.drafts.some((d) => d.signal === 'S1')).toBe(true);
    expect(withDocs.drafts.some((d) => d.signal === 'S2')).toBe(true);
    expect(withDocs.missing).not.toContain('S2');
  });

  it('prefers code-repo evidence over document evidence for the same signal', async () => {
    // Both a LIMITATIONS.md and a retrospective claim S8; only one draft wins.
    const report = await extract(repo, { docsRoot: docs });
    const s8 = report.drafts.filter((d) => d.signal === 'S8');
    expect(s8).toHaveLength(1);
    expect(s8[0]?.fields['signal']?.source).toBe('LIMITATIONS.md');
  });
});

describe('honesty properties', () => {
  it('never declares above E0 on the author\'s behalf', async () => {
    const report = await extract(repo, { docsRoot: docs });
    for (const draft of report.drafts) {
      expect(draft.fields['tier']?.value).toBe('E0');
    }
  });

  it('marks every draft retrospective', async () => {
    // Extraction reconstructs after the fact by definition. Labelling it
    // otherwise would be backdating.
    const report = await extract(repo, { docsRoot: docs });
    for (const draft of report.drafts) {
      expect(draft.fields['retrospective']?.value).toBe(true);
    }
  });

  it('demands an anchor for retrospective decision claims', async () => {
    const report = await extract(repo, { docsRoot: docs });
    const decisions = report.drafts.find((d) => d.signal === 'S6');
    expect(decisions?.gaps).toContain('anchor');
  });

  it('traces every extracted field to a source file', async () => {
    const report = await extract(repo, { docsRoot: docs });
    for (const draft of report.drafts) {
      for (const extracted of Object.values(draft.fields)) {
        expect(extracted.source.length).toBeGreaterThan(0);
      }
    }
  });

  it('renders gaps as visible placeholders, never as blanks', async () => {
    const report = await extract(repo, { docsRoot: docs });
    const s2 = report.drafts.find((d) => d.signal === 'S2');
    expect(s2).toBeDefined();
    const rendered = renderDraft(s2!);
    for (const gap of s2!.gaps) {
      expect(rendered).toContain(`${gap}: "[MEASURE:`);
    }
  });

  it('writes no prose characterising contribution or value', async () => {
    // ADR-006: extraction copies and structures. It never composes claims about
    // what the author achieved.
    const report = await extract(repo, { docsRoot: docs });
    const banned = /\bsuccessfully\b|\bimproved\b|\bachieved\b|\bdemonstrat|\bstrong\b|\bimpressive\b/i;
    for (const draft of report.drafts) {
      expect(draft.body).not.toMatch(banned);
    }
  });
});

describe('hashGoldenSet', () => {
  it('computes a stable SHA-256 from file contents', async () => {
    const a = await hashGoldenSet(repo, 'DECISIONS.md');
    const b = await hashGoldenSet(repo, 'DECISIONS.md');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns undefined for a missing file rather than throwing', async () => {
    expect(await hashGoldenSet(repo, 'nope.md')).toBeUndefined();
  });
});
