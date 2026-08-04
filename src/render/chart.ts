/**
 * Charts — DECISIONS.md D12, spec/standard-v0.1.md §8.2 and §8.4.
 *
 * Hand-rolled SVG. No DOM, no fonts measured, no library. Pure string
 * generation from numbers, which is what keeps the build byte-identical
 * (D1).
 *
 * Two rules from the standard are enforced here rather than left to styling,
 * because both are product decisions:
 *
 *   §8.2 A regression renders at the same visual weight as an improvement.
 *        Rendering a regression smaller, quieter, or collapsed is
 *        non-conforming. It is not a failure to be visually apologised for —
 *        publishable failure is the mechanism that makes fabrication pointless.
 *
 *   §8.4 Charts degrade to legible summary text below narrow breakpoints
 *        rather than shrinking. Reviewers read on phones, so the table is
 *        emitted alongside every chart and CSS chooses between them.
 */

/** One measured class: what it scored before, and after. */
export interface Series {
  readonly label: string;
  readonly baseline: number;
  readonly current: number;
}

export interface ChartOptions {
  /** Accessible title. Required — a chart with no text alternative is unreadable. */
  readonly title: string;
  /** Unit suffix for values, e.g. "%". */
  readonly unit?: string;
  /** Upper bound of the value axis. Defaults to the maximum observed value. */
  readonly max?: number;
}

const BAR_HEIGHT = 18;
const BAR_GAP = 6;
const GROUP_GAP = 16;
const LABEL_WIDTH = 160;
const CHART_WIDTH = 520;
const PAD = 12;

/** Escape text for safe inclusion in SVG or HTML. */
export function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format a number at fixed precision.
 *
 * `toLocaleString` is deliberately not used: locale is an environment read, and
 * an environment read makes the build non-deterministic (D1).
 */
export function formatValue(value: number, unit = ''): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}${unit}`;
}

/**
 * A stable identifier derived from content.
 *
 * Counters would make two renders of the same input differ, which is exactly
 * what the determinism gate exists to catch.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Direction of movement. `none` when the value did not change. */
export type Direction = 'improved' | 'regressed' | 'none';

export function direction(series: Series): Direction {
  if (series.current > series.baseline) return 'improved';
  if (series.current < series.baseline) return 'regressed';
  return 'none';
}

/**
 * Render a before/after bar chart as an SVG string.
 *
 * Baseline and current appear as paired bars per class. Both directions of
 * change use the same bar height, the same opacity, and the same label
 * treatment — §8.2 is enforced structurally rather than by convention, so a
 * later styling change cannot quietly violate it.
 */
export function renderBarChart(series: readonly Series[], options: ChartOptions): string {
  if (series.length === 0) return '';

  const observed = Math.max(...series.flatMap((s) => [s.baseline, s.current]), 0);
  const max = options.max ?? (observed > 0 ? observed : 1);
  const unit = options.unit ?? '';

  const groupHeight = BAR_HEIGHT * 2 + BAR_GAP;
  const height = PAD * 2 + series.length * groupHeight + (series.length - 1) * GROUP_GAP;
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - PAD * 2;

  const titleId = `chart-${slugify(options.title)}`;
  const rows: string[] = [];

  series.forEach((s, index) => {
    const top = PAD + index * (groupHeight + GROUP_GAP);
    const dir = direction(s);

    // Guard against a zero max producing NaN widths.
    const width = (value: number): number =>
      max <= 0 ? 0 : Math.max(0, Math.round((value / max) * plotWidth * 10) / 10);

    rows.push(
      `  <g class="series" data-direction="${dir}">`,
      `    <text class="series-label" x="${PAD}" y="${top + BAR_HEIGHT - 4}">${escapeText(s.label)}</text>`,
      `    <rect class="bar bar-baseline" x="${LABEL_WIDTH}" y="${top}" width="${width(s.baseline)}" height="${BAR_HEIGHT}" rx="2"/>`,
      `    <text class="bar-value" x="${LABEL_WIDTH + width(s.baseline) + 6}" y="${top + BAR_HEIGHT - 4}">${escapeText(formatValue(s.baseline, unit))}</text>`,
      `    <rect class="bar bar-current" x="${LABEL_WIDTH}" y="${top + BAR_HEIGHT + BAR_GAP}" width="${width(s.current)}" height="${BAR_HEIGHT}" rx="2"/>`,
      `    <text class="bar-value" x="${LABEL_WIDTH + width(s.current) + 6}" y="${top + BAR_HEIGHT * 2 + BAR_GAP - 4}">${escapeText(formatValue(s.current, unit))}</text>`,
      `  </g>`,
    );
  });

  return [
    `<svg class="chart" viewBox="0 0 ${CHART_WIDTH} ${height}" role="img" aria-labelledby="${titleId}" xmlns="http://www.w3.org/2000/svg">`,
    `  <title id="${titleId}">${escapeText(options.title)}</title>`,
    ...rows,
    `</svg>`,
  ].join('\n');
}

/**
 * Render the same data as a table.
 *
 * Emitted alongside every chart, not instead of one. §8.4 requires charts to
 * degrade to legible summary text below narrow breakpoints, and a table that
 * exists in the markup is also what a screen reader and a text-only client get.
 *
 * The delta column states direction in words as well as sign, because colour
 * must never be the sole indicator of state.
 */
export function renderSeriesTable(series: readonly Series[], options: ChartOptions): string {
  if (series.length === 0) return '';
  const unit = options.unit ?? '';

  const rows = series.map((s) => {
    const delta = s.current - s.baseline;
    const dir = direction(s);
    const sign = delta > 0 ? '+' : '';
    const word = dir === 'improved' ? 'improved' : dir === 'regressed' ? 'regressed' : 'unchanged';
    return (
      `    <tr data-direction="${dir}">` +
      `<th scope="row">${escapeText(s.label)}</th>` +
      `<td>${escapeText(formatValue(s.baseline, unit))}</td>` +
      `<td>${escapeText(formatValue(s.current, unit))}</td>` +
      `<td>${escapeText(`${sign}${formatValue(delta, unit)}`)} ${word}</td>` +
      `</tr>`
    );
  });

  return [
    `<table class="series-table">`,
    `  <caption>${escapeText(options.title)}</caption>`,
    `  <thead>`,
    `    <tr><th scope="col">Class</th><th scope="col">Baseline</th><th scope="col">Current</th><th scope="col">Change</th></tr>`,
    `  </thead>`,
    `  <tbody>`,
    ...rows,
    `  </tbody>`,
    `</table>`,
  ].join('\n');
}

/** Chart plus table. The pairing is what satisfies §8.4. */
export function renderResultFigure(series: readonly Series[], options: ChartOptions): string {
  if (series.length === 0) return '';
  return [
    `<figure class="result">`,
    renderBarChart(series, options),
    renderSeriesTable(series, options),
    `</figure>`,
  ].join('\n');
}
