/**
 * The document — spec/standard-v0.1.md §8.1, PRD FR-5.
 *
 * The four-minute front door. This is the surface H-5 lives or dies on: if a
 * reviewer comprehends no better here than from the repository, the core value
 * proposition is wrong.
 *
 * Built for someone who will not scroll twice. Above the fold, in order:
 * the problem, the hardest decision, the headline result with tier and n
 * attached, and what the author got wrong.
 *
 * The fourth item is not decoration. Publishable failure is the mechanism that
 * makes fabrication pointless (§1 P2), and putting it on the first screen is
 * that principle made structural.
 */

import { escapeText } from './chart.js';
import {
  renderAbsent,
  renderClaim,
  renderJudgmentSection,
  renderTierBadge,
  renderVerificationBoundary,
} from './page.js';
import { EVIDENCE_SIGNALS, isJudgmentSignal, type ResolvedClaim, type Signal } from '../model.js';
import { isAtLeast } from '../tier.js';

export interface FrontDoor {
  readonly title: string;
  /** One paragraph. What cost is borne, by whom. */
  readonly problem: string;
  /** The hardest decision, with what was given up. */
  readonly decision: string;
  /** What the author got wrong. Required — §8.1 item 4. */
  readonly gotWrong: string;
}

/**
 * The strongest claim, for the headline.
 *
 * "Strongest" is the highest *rendered* tier, never the highest declared one.
 * Choosing on declaration would let an overclaim decide what a reviewer sees
 * first, which inverts the capping rule at the moment it matters most.
 *
 * Ties break on path so the choice is deterministic (D1).
 */
export function headlineClaim(claims: readonly ResolvedClaim[]): ResolvedClaim | undefined {
  const ranked = [...claims].sort((a, b) => {
    if (a.rendered !== b.rendered) return isAtLeast(a.rendered, b.rendered) ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
  return ranked[0];
}

/** Evidence signals with no claim behind them. */
export function absentSignals(claims: readonly ResolvedClaim[]): readonly Signal[] {
  const present = new Set(claims.map((c) => c.signal));
  return EVIDENCE_SIGNALS.filter((s) => !present.has(s));
}

/**
 * Styles.
 *
 * Craft rules applied here rather than left to defaults:
 *  - one type scale (1.25 from 16px), six sizes, no ad-hoc values
 *  - one spatial unit (8px); every gap is a multiple
 *  - space between groups exceeds space within them, so structure is readable
 *  - measure capped at 65ch — a full-width paragraph is genuinely hard to read
 *  - one accent colour; chrome in neutrals
 *  - dark mode re-modelled, never inverted: elevation lightens rather than
 *    shadows, and no pure black or pure white
 *  - tabular numerals wherever numbers sit in columns
 */
const STYLES = `
:root {
  --unit: 8px;
  --measure: 65ch;
  --fs-xs: 12.8px; --fs-sm: 14px; --fs-base: 16px;
  --fs-lg: 20px; --fs-xl: 25px; --fs-2xl: 31.25px;
  --surface: #ffffff; --surface-raised: #f7f8fa;
  --text: #14161a; --text-muted: #5c6370;
  --border: #e3e5ea; --accent: #1f6feb;
  --improved: #1a7f37; --regressed: #b35900;
}
@media (prefers-color-scheme: dark) {
  :root {
    --surface: #0d1117; --surface-raised: #161b22;
    --text: #e9ebf0; --text-muted: #8b949e;
    --border: #262b33; --accent: #4c8dff;
    --improved: #3fb950; --regressed: #d29922;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: calc(var(--unit) * 4) calc(var(--unit) * 3);
  background: var(--surface); color: var(--text);
  font: var(--fs-base)/1.6 ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
main { max-width: 900px; margin: 0 auto; }
p, li { max-width: var(--measure); }
h1, h2, h3 { line-height: 1.15; letter-spacing: -0.02em; margin: 0; }
h1 { font-size: var(--fs-2xl); font-weight: 640; }
h2 { font-size: var(--fs-xl); font-weight: 620; margin-top: calc(var(--unit) * 6); }
h3 { font-size: var(--fs-lg); font-weight: 600; }

.front-door { border-bottom: 1px solid var(--border); padding-bottom: calc(var(--unit) * 4); }
.front-door > section { margin-top: calc(var(--unit) * 4); }
.front-door h2 {
  font-size: var(--fs-xs); font-weight: 640; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text-muted); margin: 0 0 var(--unit);
}
.headline { font-size: var(--fs-lg); }

.tier {
  display: inline-block; padding: 2px calc(var(--unit) * 0.75);
  border-radius: 4px; background: var(--accent); color: #fff;
  font-size: var(--fs-xs); font-weight: 640; font-variant-numeric: tabular-nums;
}
.tier-E0, .tier-E1 { background: var(--text-muted); }
.claim-n {
  margin-left: calc(var(--unit) * 0.75); font-size: var(--fs-sm);
  color: var(--text-muted); font-variant-numeric: tabular-nums;
}
.claim-capped {
  margin-left: calc(var(--unit) * 0.75); font-size: var(--fs-xs);
  color: var(--regressed); border: 1px solid currentColor;
  border-radius: 3px; padding: 0 4px;
}
.signal {
  font: 640 var(--fs-xs)/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--accent); margin-right: calc(var(--unit) * 0.75);
}
.provenance {
  font-size: var(--fs-sm); color: var(--text-muted);
  margin: var(--unit) 0 0; font-variant-numeric: tabular-nums;
}
.flag { border: 1px solid var(--border); border-radius: 3px; padding: 0 4px; }
.flag-unanchored { color: var(--regressed); border-color: currentColor; }

.claim {
  border: 1px solid var(--border); border-radius: 6px;
  padding: calc(var(--unit) * 2); margin-top: calc(var(--unit) * 2);
  background: var(--surface-raised);
}
.claim-source { font-size: var(--fs-sm); margin: var(--unit) 0 0; }
.claim-source a { color: var(--accent); }

.honour-note {
  border-left: 3px solid var(--regressed);
  padding-left: calc(var(--unit) * 2); color: var(--text-muted);
}
.absent { margin-top: calc(var(--unit) * 4); }
.absent ul { list-style: none; padding: 0; }
.absent li { color: var(--text-muted); padding: calc(var(--unit) * 0.5) 0; }

table { border-collapse: collapse; width: 100%; font-size: var(--fs-sm); }
caption { text-align: left; font-weight: 620; padding-bottom: var(--unit); }
th, td {
  text-align: left; padding: var(--unit); border-bottom: 1px solid var(--border);
  font-variant-numeric: tabular-nums;
}
.verified-no { color: var(--regressed); font-weight: 620; }
.verified-yes { color: var(--improved); font-weight: 620; }

/* Regressions carry the same visual weight as improvements (§8.2). Colour
   distinguishes direction; size, opacity, and weight never do. */
.bar { fill: var(--accent); }
.bar-baseline { fill: var(--text-muted); opacity: 0.45; }
[data-direction="regressed"] .bar-current { fill: var(--regressed); }
[data-direction="improved"] .bar-current { fill: var(--improved); }
.series-label, .bar-value {
  font: var(--fs-xs)/1 ui-sans-serif, sans-serif; fill: var(--text);
}
.bar-value { font-variant-numeric: tabular-nums; }
figure { margin: calc(var(--unit) * 2) 0; }
.chart { width: 100%; height: auto; }

/* §8.4 — below the breakpoint the chart is replaced by its table rather than
   shrunk into illegibility. Both exist in the markup; CSS chooses. */
.series-table { display: none; }
@media (max-width: 640px) {
  .chart { display: none; }
  .series-table { display: table; }
}
`;

/** The four-minute front door (§8.1). */
export function renderFrontDoor(front: FrontDoor, headline: ResolvedClaim | undefined): string {
  const result =
    headline === undefined
      ? `<p class="headline">No claim in this repository is supported by an artifact yet.</p>`
      : `<p class="headline">${renderTierBadge(headline)} ${escapeText(headline.path)}</p>`;

  return [
    `<header class="front-door">`,
    `  <h1>${escapeText(front.title)}</h1>`,
    `  <section><h2>The problem</h2><p>${escapeText(front.problem)}</p></section>`,
    `  <section><h2>The hardest decision</h2><p>${escapeText(front.decision)}</p></section>`,
    `  <section><h2>Headline result</h2>${result}</section>`,
    `  <section><h2>What I got wrong</h2><p>${escapeText(front.gotWrong)}</p></section>`,
    `</header>`,
  ].join('\n');
}

/** The complete page. Self-contained: no external requests (ADR-007). */
export function renderDocument(
  front: FrontDoor,
  claims: readonly ResolvedClaim[],
  builtAt: string,
): string {
  const evidence = claims.filter((c) => !isJudgmentSignal(c.signal));

  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeText(front.title)}</title>`,
    `<style>${STYLES}</style>`,
    `</head>`,
    `<body>`,
    `<main>`,
    renderFrontDoor(front, headlineClaim(claims)),
    `<section class="evidence">`,
    `<h2>Evidence signals</h2>`,
    ...evidence.map(renderClaim),
    `</section>`,
    renderJudgmentSection(claims),
    renderAbsent(absentSignals(evidence)),
    renderVerificationBoundary(),
    `<footer class="provenance"><p>Built ${escapeText(builtAt)} from the repository. Every claim links to the artifact behind it.</p></footer>`,
    `</main>`,
    `</body>`,
    `</html>`,
  ].join('\n');
}
