/**
 * Evidence path mapping.
 *
 * The standard defines a canonical layout for artifacts it asks an author to
 * *write*. It was wrong to require that layout for artifacts that already
 * exist.
 *
 * Applying the standard to a real repository surfaced this immediately: a
 * project with 50 structured eval cases and 10 dated baseline runs was reported
 * as having no E3 evidence at all, because its golden set is a Python module
 * (`tests/eval/queries.py`) rather than `evals/golden/*.jsonl`. Keeping the
 * cases in Python is the correct engineering choice there — the graders are
 * Python functions — and no glob over `.jsonl` will ever find it.
 *
 * That failure mode is worse than having no tool. An author who trusts the
 * report concludes their strongest evidence does not count, which discourages
 * exactly the behaviour the standard exists to reward.
 *
 * So paths are configurable, declared by the author in `preview.config.json`:
 *
 *   {
 *     "evidence": {
 *       "goldenSet":       ["tests/eval/queries.py"],
 *       "baseline":        ["benchmark_results/*.json"],
 *       "taxonomy":        ["tests/eval/queries.py"],
 *       "discovery":       ["docs/product/discovery/synthesis.md"],
 *       "instrumentation": [],
 *       "comparison":      []
 *     }
 *   }
 *
 * This is a claim by the author about their own repository, and it is checkable
 * the same way every other claim is: the files either exist and have the
 * required shape, or the tier caps. Configuring a path cannot manufacture
 * evidence — it can only point at evidence that is already there.
 */

/** Evidence kinds the resolver needs to locate. */
export const EVIDENCE_KINDS = [
  'goldenSet',
  'baseline',
  'taxonomy',
  'discovery',
  'instrumentation',
  'comparison',
] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export type EvidenceMap = Readonly<Record<EvidenceKind, readonly string[]>>;

/**
 * The standard's canonical layout, used when an author declares nothing.
 *
 * These remain the paths the standard prescribes for new work. They are a
 * default, not a requirement.
 */
export const DEFAULT_EVIDENCE_MAP: EvidenceMap = Object.freeze({
  goldenSet: ['evals/golden/*'],
  baseline: ['evals/baseline-*'],
  taxonomy: ['evals/taxonomy.md'],
  discovery: ['docs/product/discovery/synthesis.md'],
  instrumentation: ['docs/product/instrumentation.md'],
  comparison: ['docs/product/comparison.md'],
});

/**
 * Match a repo-relative path against a glob.
 *
 * Deliberately minimal: `*` matches within a segment, `**` across segments.
 * A full glob implementation would be a dependency and a determinism surface
 * for a feature that needs neither.
 */
export function matchesGlob(pattern: string, path: string): boolean {
  // Built by walking the pattern, so `**` and `*` are handled directly. An
  // earlier version substituted a placeholder character and replaced it
  // afterwards, which silently breaks on any pattern containing that
  // character.
  let expression = '';

  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i] ?? '';

    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        expression += '.*';
        i += 1; // consume the second star
      } else {
        expression += '[^/]*';
      }
      continue;
    }

    expression += /[.+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
  }

  return new RegExp(`^${expression}$`).test(path);
}

/**
 * Read the evidence map from repository config.
 *
 * Unreadable or absent config yields the default map. A malformed entry is
 * ignored rather than throwing — an author who mistypes one path should lose
 * that one path, not the whole build.
 */
export function readEvidenceMap(config: Readonly<Record<string, unknown>>): EvidenceMap {
  const declared = config['evidence'];
  if (declared === null || typeof declared !== 'object' || Array.isArray(declared)) {
    return DEFAULT_EVIDENCE_MAP;
  }

  const record = declared as Record<string, unknown>;
  const out: Record<EvidenceKind, readonly string[]> = { ...DEFAULT_EVIDENCE_MAP };

  for (const kind of EVIDENCE_KINDS) {
    const value = record[kind];
    if (!Array.isArray(value)) continue;

    const patterns = value.filter((v): v is string => typeof v === 'string' && v.length > 0);
    // An explicit empty array is meaningful: "this project has none of this".
    // It must not silently fall back to the default path.
    out[kind] = patterns;
  }

  return Object.freeze(out);
}

/** Every path matching any pattern for a kind. */
export function resolveEvidence(
  map: EvidenceMap,
  kind: EvidenceKind,
  paths: readonly string[],
): readonly string[] {
  const patterns = map[kind];
  if (patterns.length === 0) return [];
  return paths.filter((p) => patterns.some((pattern) => matchesGlob(pattern, p)));
}
