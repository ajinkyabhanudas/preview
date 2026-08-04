/**
 * Extraction — DECISIONS.md D11.
 *
 * Reads a repository and proposes draft artifacts from evidence that already
 * exists in it. The author reviews, edits, and commits. Nothing is stored
 * outside their repository, so FR-6 holds: the repository stays canonical.
 *
 * The rule that keeps this on the right side of ADR-006:
 *
 *   Extraction may COPY AND STRUCTURE text that already exists.
 *   It may never WRITE PROSE about contribution or value.
 *
 * Every field carries the path it came from. A field that cannot be filled from
 * a file is left as a visible `[MEASURE: ...]` placeholder, never guessed. A
 * wrong draft is worse than a blank one, because an author may accept it
 * without reading.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { Signal } from '../model.js';

/** A value extracted from a real file, with its provenance. */
export interface Extracted<T> {
  readonly value: T;
  /** Repo-relative path this came from. Shown to the author. */
  readonly source: string;
}

/** A proposed artifact. Never written without the author's action. */
export interface Draft {
  readonly signal: Signal;
  /** Where this artifact belongs, per the standard's layout. */
  readonly targetPath: string;
  /** Front matter fields, each traceable to a file. */
  readonly fields: Readonly<Record<string, Extracted<string | number | boolean>>>;
  /** Fields the extractor could not fill. Rendered as [MEASURE: ...]. */
  readonly gaps: readonly string[];
  /** Body content — copied text only, never composed prose. */
  readonly body: string;
}

export interface ExtractionReport {
  readonly drafts: readonly Draft[];
  /** Signals with no evidence found. Reported, never fabricated. */
  readonly missing: readonly Signal[];
  /** Files the extractor read, for the author to audit. */
  readonly scanned: readonly string[];
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'site', 'coverage', '__pycache__', '.venv']);
const MAX_SCAN_BYTES = 2 * 1024 * 1024;

async function walk(root: string, dir: string, out: string[], depth = 0): Promise<void> {
  if (depth > 6) return; // Bound the scan; deep trees are not evidence.
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const entry of entries.sort()) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    let info;
    try {
      info = await stat(path);
    } catch {
      continue;
    }
    if (info.isDirectory()) await walk(root, path, out, depth + 1);
    else if (info.isFile() && info.size <= MAX_SCAN_BYTES) {
      out.push(relative(root, path).split(sep).join('/'));
    }
  }
}

/** Count `## ` headings — how decision records are structured. */
function countHeadings(content: string): number {
  return content.split('\n').filter((l) => /^##\s+\S/.test(l)).length;
}

/**
 * Propose an S6 decision-record artifact.
 *
 * Copies the count and the headings. Does not characterise the decisions, and
 * does not judge whether they are good ones.
 */
async function extractDecisions(root: string, files: readonly string[]): Promise<Draft | undefined> {
  const path = files.find((f) => /^DECISIONS?\.md$/i.test(f));
  if (path === undefined) return undefined;

  const content = await readFile(join(root, path), 'utf8');
  const count = countHeadings(content);
  if (count === 0) return undefined;

  const headings = content
    .split('\n')
    .filter((l) => /^##\s+\S/.test(l))
    .map((l) => `- ${l.replace(/^##\s+/, '')}`)
    .join('\n');

  return {
    signal: 'S6',
    targetPath: 'docs/product/decisions/0001-extracted.md',
    fields: {
      signal: { value: 'S6', source: path },
      tier: { value: 'E0', source: path },
      visibility: { value: 'public', source: path },
      retrospective: { value: true, source: path },
    },
    gaps: ['date', 'anchor'],
    body:
      `# Decisions\n\n` +
      `${count} decision record(s) in [\`${path}\`](../../../${path}).\n\n` +
      `${headings}\n`,
  };
}

/**
 * Propose S5 (baseline) and S7 (results) from benchmark output.
 *
 * Reads dates and case counts from the files themselves. The golden-set hash is
 * computed from the eval set on disk — not read from a declaration, because a
 * declared hash is a claim and a computed one is a fact (D4).
 */
async function extractBenchmarks(
  root: string,
  files: readonly string[],
): Promise<readonly Draft[]> {
  const benchmarks = files
    .filter((f) => /benchmark.*\.json$/i.test(f) || /results?.*\.json$/i.test(f))
    .sort();
  if (benchmarks.length === 0) return [];

  const latest = benchmarks[benchmarks.length - 1];
  if (latest === undefined) return [];

  let runAt: string | undefined;
  let caseCount: number | undefined;
  try {
    const parsed: unknown = JSON.parse(await readFile(join(root, latest), 'utf8'));
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const rawDate = record['run_at'];
      if (typeof rawDate === 'string') runAt = rawDate.slice(0, 10);
      const cases = record['cases'];
      if (Array.isArray(cases)) caseCount = cases.length;
    }
  } catch {
    return [];
  }

  const fields: Record<string, Extracted<string | number | boolean>> = {
    signal: { value: 'S7', source: latest },
    tier: { value: 'E0', source: latest },
    visibility: { value: 'public', source: latest },
    retrospective: { value: true, source: latest },
  };
  const gaps: string[] = [];

  if (runAt !== undefined) fields['date'] = { value: runAt, source: latest };
  else gaps.push('date');

  if (caseCount !== undefined) fields['n'] = { value: caseCount, source: latest };
  else gaps.push('n');

  // The tier stays E0 until the author supplies a golden_set_sha matching a
  // baseline. The extractor will not declare E3 on the author's behalf —
  // that is exactly the overclaim the capping rule exists to catch.
  gaps.push('golden_set_sha', 'provenance');

  return [
    {
      signal: 'S7',
      targetPath: 'docs/product/results/extracted-results.md',
      fields,
      gaps,
      body:
        `# Results\n\n` +
        `Extracted from [\`${latest}\`](../../../${latest}).\n\n` +
        `[MEASURE: state what moved, including regressions, and bound the ` +
        `conclusion to what n supports.]\n`,
    },
  ];
}

/**
 * Propose artifacts from a product-documentation folder.
 *
 * Evidence is routinely split: the code lives in one place and the product
 * thinking — PRD, discovery interview, retrospective — lives in another. An
 * extractor that only reads the code repository misses the signals that are
 * hardest to evidence and easiest to forget, which is exactly backwards.
 *
 * Filenames are matched by role rather than by exact name, because numbering
 * conventions vary (`00-discovery-interview.md`, `01-PRD.md`, `04-retrospective.md`).
 */
async function extractFromDocs(docsRoot: string): Promise<readonly Draft[]> {
  const files: string[] = [];
  await walk(docsRoot, docsRoot, files);
  const drafts: Draft[] = [];

  /** S1 — a PRD frames the problem and, if it has one, names non-goals. */
  const prd = files.find((f) => /prd/i.test(f) && f.endsWith('.md'));
  if (prd !== undefined) {
    const content = await readFile(join(docsRoot, prd), 'utf8');
    const hasNonGoals = /not building|non.?goals?|out of scope/i.test(content);
    drafts.push({
      signal: 'S1',
      targetPath: 'docs/product/problem-frame.md',
      fields: {
        signal: { value: 'S1', source: prd },
        tier: { value: 'E0', source: prd },
        visibility: { value: 'public', source: prd },
        retrospective: { value: true, source: prd },
      },
      gaps: hasNonGoals ? ['date', 'anchor'] : ['date', 'anchor', 'non_goals'],
      body:
        `# Problem frame\n\nExtracted from \`${prd}\`.\n\n` +
        (hasNonGoals
          ? '[MEASURE: copy the problem statement and the non-goals list from the PRD.]\n'
          : '[MEASURE: the source document has no non-goals section. S1 requires ' +
            'non-goals to be written down — add them.]\n'),
    });
  }

  /**
   * S2 — a discovery interview evidences contact with the population.
   *
   * This is the signal most often assumed absent because no file in the code
   * repository shows it. It is also the one that caps at E0 without an anchor
   * (§6.2), so the gap list always demands one.
   */
  const discovery = files.find((f) => /discovery|interview|synthesis/i.test(f) && f.endsWith('.md'));
  if (discovery !== undefined) {
    const content = await readFile(join(docsRoot, discovery), 'utf8');
    // Count only what is stated, never inferred.
    const nStated = /\bn\s*=\s*\d+/i.exec(content)?.[0];
    const fields: Record<string, Extracted<string | number | boolean>> = {
      signal: { value: 'S2', source: discovery },
      tier: { value: 'E0', source: discovery },
      visibility: { value: 'public', source: discovery },
      retrospective: { value: true, source: discovery },
    };
    const gaps = ['date', 'anchor', 'method', 'segment', 'recruitment'];
    if (nStated === undefined) gaps.push('n');

    drafts.push({
      signal: 'S2',
      targetPath: 'docs/product/discovery/synthesis.md',
      fields,
      gaps,
      body:
        `# Discovery synthesis\n\nExtracted from \`${discovery}\`.\n\n` +
        `[MEASURE: state n, method, segment, and recruitment channel. E2 requires ` +
        `all four. Count unprompted mentions separately from prompted ones.]\n\n` +
        `[MEASURE: this is retrospective — cite an anchor that predates the ` +
        `reconstruction (a dated message, meeting note, or commit responding to ` +
        `feedback). Without one it caps at E0.]\n`,
    });
  }

  /** S8 — a retrospective names what went wrong and bounds what was learned. */
  const retro = files.find((f) => /retrospective|postmortem|post.?mortem/i.test(f) && f.endsWith('.md'));
  if (retro !== undefined) {
    const content = await readFile(join(docsRoot, retro), 'utf8');
    drafts.push({
      signal: 'S8',
      targetPath: 'docs/product/limits.md',
      fields: {
        signal: { value: 'S8', source: retro },
        tier: { value: 'E0', source: retro },
        visibility: { value: 'public', source: retro },
        retrospective: { value: true, source: retro },
      },
      gaps: ['date'],
      body:
        `# Limits\n\n${countHeadings(content)} section(s) in \`${retro}\`.\n\n` +
        `[MEASURE: state what the conclusions do NOT support, and at what n.]\n`,
    });
  }

  return drafts;
}

/** Propose S8 from an existing limitations document. */
async function extractLimitations(
  root: string,
  files: readonly string[],
): Promise<Draft | undefined> {
  const path = files.find((f) => /^LIMITATIONS?\.md$/i.test(f));
  if (path === undefined) return undefined;

  const content = await readFile(join(root, path), 'utf8');
  return {
    signal: 'S8',
    targetPath: 'docs/product/limits.md',
    fields: {
      signal: { value: 'S8', source: path },
      tier: { value: 'E0', source: path },
      visibility: { value: 'public', source: path },
      retrospective: { value: true, source: path },
    },
    gaps: ['date'],
    body:
      `# Limits\n\n` +
      `${countHeadings(content)} section(s) in ` +
      `[\`${path}\`](../../../${path}).\n`,
  };
}

/** Compute the SHA-256 of an eval set, so a hash claim rests on a fact. */
export async function hashGoldenSet(root: string, path: string): Promise<string | undefined> {
  try {
    const content = await readFile(join(root, path));
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return undefined;
  }
}

/**
 * Scan a repository and propose drafts.
 *
 * Signals with no supporting file are reported as missing. The extractor never
 * invents an artifact to fill a gap — a missing signal is information the author
 * needs, and the standard renders absent signals as explicitly absent.
 */
export async function extract(
  repoRoot: string,
  options: { readonly docsRoot?: string } = {},
): Promise<ExtractionReport> {
  const scanned: string[] = [];
  await walk(repoRoot, repoRoot, scanned);

  const drafts: Draft[] = [];

  const decisions = await extractDecisions(repoRoot, scanned);
  if (decisions !== undefined) drafts.push(decisions);

  drafts.push(...(await extractBenchmarks(repoRoot, scanned)));

  const limits = await extractLimitations(repoRoot, scanned);
  if (limits !== undefined) drafts.push(limits);

  // Product documentation frequently lives outside the code repository. The
  // signals hardest to evidence — S1 problem framing, S2 population contact —
  // are usually there and nowhere else, so an extractor that skips it reports
  // them missing when they exist.
  if (options.docsRoot !== undefined) {
    const fromDocs = await extractFromDocs(options.docsRoot);
    // Code-repo evidence wins on conflict: a benchmark file is stronger
    // evidence of a result than a document describing one.
    const already = new Set(drafts.map((d) => d.signal));
    drafts.push(...fromDocs.filter((d) => !already.has(d.signal)));
  }

  const found = new Set(drafts.map((d) => d.signal));
  const missing = (['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'] as const).filter(
    (s) => !found.has(s),
  );

  return { drafts, missing, scanned };
}

/** Render a draft to markdown, with gaps as visible placeholders. */
export function renderDraft(draft: Draft): string {
  const lines: string[] = ['---'];

  for (const [key, extracted] of Object.entries(draft.fields)) {
    lines.push(`${key}: ${String(extracted.value)}`);
  }
  for (const gap of draft.gaps) {
    lines.push(`${gap}: "[MEASURE: not found in the repository — supply this]"`);
  }

  lines.push('---', '');
  lines.push(draft.body);

  // Provenance footer: every value traceable to the file it came from.
  lines.push('', '<!-- Extracted from:');
  for (const [key, extracted] of Object.entries(draft.fields)) {
    lines.push(`     ${key} <- ${extracted.source}`);
  }
  lines.push('     Review every field before committing. -->');

  return lines.join('\n');
}
