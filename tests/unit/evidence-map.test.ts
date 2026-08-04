/**
 * Evidence path mapping tests.
 *
 * Written after applying the standard to a real repository, which reported a
 * project with 50 structured eval cases and 10 dated baselines as having no E3
 * evidence at all — because its golden set is a Python module rather than a
 * `.jsonl` file under the standard's prescribed path.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EVIDENCE_MAP,
  matchesGlob,
  readEvidenceMap,
  resolveEvidence,
} from '../../src/validate/evidence-map.js';
import { buildSupportContext } from '../../src/validate/schema.js';
import type { ParsedDocument } from '../../src/model.js';

const doc = (path: string, frontMatter = {}, body = 'x'): ParsedDocument => ({
  path,
  frontMatter,
  body,
});

describe('matchesGlob', () => {
  it('matches an exact path', () => {
    expect(matchesGlob('tests/eval/queries.py', 'tests/eval/queries.py')).toBe(true);
    expect(matchesGlob('tests/eval/queries.py', 'tests/eval/other.py')).toBe(false);
  });

  it('matches * within a segment only', () => {
    expect(matchesGlob('benchmark_results/*.json', 'benchmark_results/run.json')).toBe(true);
    expect(matchesGlob('benchmark_results/*.json', 'benchmark_results/a/b.json')).toBe(false);
  });

  it('matches ** across segments', () => {
    expect(matchesGlob('evals/**/*.jsonl', 'evals/golden/v1.jsonl')).toBe(true);
    expect(matchesGlob('evals/**', 'evals/a/b/c.txt')).toBe(true);
  });

  it('treats regex metacharacters as literals', () => {
    // A pattern containing `.` must not match any character.
    expect(matchesGlob('a.json', 'axjson')).toBe(false);
    expect(matchesGlob('a.json', 'a.json')).toBe(true);
  });
});

describe('readEvidenceMap', () => {
  it('returns the standard layout when nothing is declared', () => {
    expect(readEvidenceMap({})).toEqual(DEFAULT_EVIDENCE_MAP);
  });

  it('honours declared paths', () => {
    const map = readEvidenceMap({ evidence: { goldenSet: ['tests/eval/queries.py'] } });
    expect(map.goldenSet).toEqual(['tests/eval/queries.py']);
  });

  it('keeps defaults for kinds that are not declared', () => {
    const map = readEvidenceMap({ evidence: { goldenSet: ['x.py'] } });
    expect(map.baseline).toEqual(DEFAULT_EVIDENCE_MAP.baseline);
  });

  it('treats an explicit empty array as "this project has none"', () => {
    // Distinct from "not declared". Falling back to the default here would
    // silently look for evidence the author has said does not exist.
    const map = readEvidenceMap({ evidence: { instrumentation: [] } });
    expect(map.instrumentation).toEqual([]);
  });

  it('ignores malformed entries rather than throwing', () => {
    const map = readEvidenceMap({ evidence: { goldenSet: [123, null, 'ok.py', ''] } });
    expect(map.goldenSet).toEqual(['ok.py']);
  });

  it('ignores a non-object evidence field', () => {
    expect(readEvidenceMap({ evidence: 'nope' })).toEqual(DEFAULT_EVIDENCE_MAP);
    expect(readEvidenceMap({ evidence: ['a'] })).toEqual(DEFAULT_EVIDENCE_MAP);
  });
});

describe('resolveEvidence', () => {
  it('returns nothing for a kind with no patterns', () => {
    const map = readEvidenceMap({ evidence: { comparison: [] } });
    expect(resolveEvidence(map, 'comparison', ['docs/product/comparison.md'])).toEqual([]);
  });

  it('finds files matching any declared pattern', () => {
    const map = readEvidenceMap({ evidence: { baseline: ['bench/*.json', 'old/*.json'] } });
    const found = resolveEvidence(map, 'baseline', ['bench/a.json', 'old/b.json', 'other/c.json']);
    expect(found).toEqual(['bench/a.json', 'old/b.json']);
  });
});

describe('support context honours declared paths', () => {
  /**
   * The failure this fixes: a golden set kept as a Python module because the
   * graders are Python functions — the correct engineering choice — was
   * unreachable, so the project scored zero for E3 evidence.
   */
  it('finds a golden set outside the standard layout', () => {
    const docs = [doc('tests/eval/queries.py', {}, 'EvalCase(...)')];

    const withDefaults = buildSupportContext(docs, []);
    expect(withDefaults.hasGoldenSet).toBe(false);

    const withDeclared = buildSupportContext(
      docs,
      [],
      readEvidenceMap({ evidence: { goldenSet: ['tests/eval/queries.py'] } }),
    );
    expect(withDeclared.hasGoldenSet).toBe(true);
  });

  it('finds a baseline outside the standard layout', () => {
    const docs = [doc('benchmark_results/run.json', { golden_set_sha: 'a'.repeat(64) })];
    const map = readEvidenceMap({ evidence: { baseline: ['benchmark_results/*.json'] } });
    expect(buildSupportContext(docs, [], map).baselineSha).toBe('a'.repeat(64));
  });

  it('still requires the evidence to have the right shape', () => {
    // Declaring a path cannot manufacture evidence. An empty golden set is
    // still no golden set.
    const docs = [doc('tests/eval/queries.py', {}, '   ')];
    const map = readEvidenceMap({ evidence: { goldenSet: ['tests/eval/queries.py'] } });
    expect(buildSupportContext(docs, [], map).hasGoldenSet).toBe(false);
  });

  it('still requires all four discovery fields', () => {
    const docs = [doc('research/interviews.md', { n: 9, method: 'interview' })];
    const map = readEvidenceMap({ evidence: { discovery: ['research/interviews.md'] } });
    expect(buildSupportContext(docs, [], map).hasDiscoverySynthesis).toBe(false);
  });
});
