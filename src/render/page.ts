/**
 * Page rendering — spec/standard-v0.1.md §8, spec/build-v1.md §3.5.
 *
 * Deliberately boring. A bug here costs an afternoon; a bug in tier resolution
 * is a false statement made to someone making a hiring decision. The design
 * attention lives in `src/resolve/`, and this file stays predictable.
 *
 * Four requirements from the standard are enforced in code rather than left to
 * CSS, because each is a product decision that a styling change must not be
 * able to quietly reverse:
 *
 *   §8.1 The front door carries problem, hardest decision, headline result with
 *        tier and n inline, and what the author got wrong.
 *   §8.3 Dates and version tags render next to every metric, not suppressible.
 *   §8.3 Evidence signals are visually separated from judgment signals, with
 *        the honour-system nature of the latter stated in the output.
 *   §9   The verification boundary is reproduced in the output, not only in the
 *        specification.
 */

import { escapeText } from './chart.js';
import type { ResolvedClaim, Signal } from '../model.js';
import { isJudgmentSignal } from '../model.js';
import type { Tier } from '../tier.js';

/** What each tier rests on. Rendered next to the badge so a reader need not
 *  already know the ladder — SQ-1 is unresolved, so nothing assumes they do. */
const TIER_MEANING: Readonly<Record<Tier, string>> = Object.freeze({
  E0: 'an assertion',
  E1: 'one instance',
  E2: 'coded qualitative work',
  E3: 'offline evaluation against a frozen set',
  E4: 'instrumented usage',
  E5: 'controlled comparison',
});

const SIGNAL_NAME: Readonly<Record<Signal, string>> = Object.freeze({
  S1: 'Framed the problem, with non-goals',
  S2: 'Made contact with the population',
  S3: 'Defined what good means before building',
  S4: 'Built a fixed test set',
  S5: 'Established a baseline',
  S6: 'Recorded a decision with its rejected options',
  S7: 'Re-measured and reported what moved',
  S8: 'Bounded conclusions to what n supports',
  J1: 'Named a contestable model judgment',
  J2: 'Mapped confidence to interface behaviour',
  J3: 'Workflow arithmetic',
  J4: 'Rejected or removed AI',
});

/**
 * A tier badge.
 *
 * `n` renders inline and is never separated from the tier — a number without
 * its denominator is the thing the standard exists to prevent. `title` carries
 * the tier's meaning so the badge is legible to a reader who has not read §2.
 */
export function renderTierBadge(claim: ResolvedClaim): string {
  const meaning = TIER_MEANING[claim.rendered];
  const n = claim.n !== undefined ? `<span class="claim-n">n=${claim.n}</span>` : '';
  const capped =
    claim.rendered === claim.declared
      ? ''
      : `<span class="claim-capped" title="Declared ${escapeText(claim.declared)}; the repository supports ${escapeText(claim.supported)}.">capped</span>`;

  return (
    `<span class="tier tier-${claim.rendered}" title="${escapeText(meaning)}">` +
    `${escapeText(claim.rendered)}</span>${n}${capped}`
  );
}

/**
 * Metadata that must appear next to every metric (§8.3) and cannot be
 * configured off. A stale eval from a model version dead eighteen months is a
 * different claim from a current one.
 */
export function renderProvenance(claim: ResolvedClaim): string {
  const parts: string[] = [];
  if (claim.date !== undefined) parts.push(`<time datetime="${escapeText(claim.date)}">${escapeText(claim.date)}</time>`);
  if (claim.provenance !== undefined) parts.push(escapeText(claim.provenance));
  if (claim.goldenSetSha !== undefined) {
    parts.push(`set <code>${escapeText(claim.goldenSetSha.slice(0, 12))}</code>`);
  }
  if (claim.retrospective) {
    const anchored = claim.anchor !== undefined;
    parts.push(
      anchored
        ? `<span class="flag flag-retrospective">reconstructed, anchored</span>`
        : `<span class="flag flag-unanchored">reconstructed, no anchor</span>`,
    );
  }
  return parts.length > 0 ? `<p class="provenance">${parts.join(' · ')}</p>` : '';
}

/** One claim, as a card. */
export function renderClaim(claim: ResolvedClaim): string {
  return [
    `<article class="claim" id="${escapeText(claim.signal)}-${escapeText(claim.path.replace(/[^\w]+/g, '-'))}">`,
    `  <h3><span class="signal">${escapeText(claim.signal)}</span> ${escapeText(SIGNAL_NAME[claim.signal])}</h3>`,
    `  <p class="claim-tier">${renderTierBadge(claim)}</p>`,
    `  ${renderProvenance(claim)}`,
    `  <p class="claim-source"><a href="${escapeText(claim.path)}">${escapeText(claim.path)}</a></p>`,
    `</article>`,
  ].join('\n');
}

/**
 * Signals with no artifact behind them.
 *
 * Rendered as explicitly absent rather than omitted. A standard that let an
 * author hide gaps would be a standard for hiding gaps, and §3.3 requires
 * `absent` and `not applicable` to be visually distinct.
 */
export function renderAbsent(signals: readonly Signal[]): string {
  if (signals.length === 0) return '';
  const items = signals
    .map((s) => `    <li><span class="signal">${escapeText(s)}</span> ${escapeText(SIGNAL_NAME[s])}</li>`)
    .join('\n');
  return [
    `<section class="absent">`,
    `  <h3>Not evidenced</h3>`,
    `  <p>These signals have no artifact in this repository. They are shown because omitting them would misrepresent what is here.</p>`,
    `  <ul>`,
    items,
    `  </ul>`,
    `</section>`,
  ].join('\n');
}

/**
 * The verification boundary (§9).
 *
 * Required in rendered output, not only in the specification. A product that
 * implies more verification than it performs is doing the thing this project
 * exists to prevent.
 */
export function renderVerificationBoundary(): string {
  const rows: readonly (readonly [string, string, string])[] = [
    ['A declared tier is supported by artifacts of the required shape', 'Yes', 'Mechanical'],
    ['A golden set was unchanged between baseline and result', 'Yes', 'Hash equality'],
    ['A redacted artifact declares what was withheld', 'Yes', 'Build fails without it'],
    ['Retrospective work is labelled', 'Partly', 'The flag is enforced; the honesty of setting it is not'],
    ['Interviews describe real conversations', 'No', 'Nothing in a repository can attest to it'],
    ['The golden set represents real inputs', 'No', 'Not decidable from the file'],
    ['Reported numbers came from the run they claim', 'No', 'The number is typed by a human'],
    ['The work was any good', 'No', 'Out of scope — that is the reader’s judgment'],
  ];

  const body = rows
    .map(
      ([property, verified, how]) =>
        `    <tr><td>${escapeText(property)}</td><td class="verified-${verified.toLowerCase()}">${escapeText(verified)}</td><td>${escapeText(how)}</td></tr>`,
    )
    .join('\n');

  return [
    `<section class="boundary" id="what-is-verified">`,
    `  <h2>What this does and does not verify</h2>`,
    `  <p>A tier means artifacts of the required shape exist and are internally consistent. It never means the claim is true.</p>`,
    `  <table>`,
    `    <thead><tr><th scope="col">Property</th><th scope="col">Verified</th><th scope="col">How, or why not</th></tr></thead>`,
    `    <tbody>`,
    body,
    `    </tbody>`,
    `  </table>`,
    `</section>`,
  ].join('\n');
}

/**
 * Judgment signals, separated from evidence signals (§8.3).
 *
 * The separation is structural because the difference is real: no file proves
 * someone understood a cost asymmetry, so these carry a structural validator
 * only. Collapsing the two families would overstate how much of the standard
 * is mechanically enforced.
 */
export function renderJudgmentSection(claims: readonly ResolvedClaim[]): string {
  const judgment = claims.filter((c) => isJudgmentSignal(c.signal));
  if (judgment.length === 0) return '';
  return [
    `<section class="judgment">`,
    `  <h2>Judgment signals</h2>`,
    `  <p class="honour-note"><strong>These are honour-system signals.</strong> No file proves that someone understood a cost asymmetry. The standard checks only that each claim names a live alternative and an accepted cost — it cannot confirm the decision was made, or made for the stated reason.</p>`,
    ...judgment.map(renderClaim),
    `</section>`,
  ].join('\n');
}
