/**
 * Reading the front door from the repository.
 *
 * The four elements §8.1 requires — the problem, the hardest decision, the
 * headline result, and what the author got wrong — are prose. They cannot be
 * extracted, and ADR-006 forbids composing them, so they must be authored.
 *
 * They live in `docs/product/product-notes.md`, which the standard's repository
 * layout already names as the front door. Keeping them in a repository file
 * rather than in config or a database is what keeps FR-6 intact: the repository
 * stays canonical and the site remains a projection of it.
 *
 * A missing section is rendered as a visible `[MEASURE: ...]` placeholder
 * rather than silently omitted. A front door with three of four elements should
 * look incomplete, because it is.
 */

import type { FrontDoor } from './document.js';

/** Headings recognised for each element, lowercased and matched loosely. */
const SECTION_ALIASES: Readonly<Record<keyof Omit<FrontDoor, 'title'>, readonly string[]>> =
  Object.freeze({
    problem: ['the problem', 'problem'],
    decision: ['the hardest decision', 'hardest decision', 'the decision'],
    gotWrong: ['what i got wrong', 'what went wrong', 'what i would do differently'],
  });

const MISSING: Readonly<Record<keyof Omit<FrontDoor, 'title'>, string>> = Object.freeze({
  problem: '[MEASURE: state the problem as a cost borne by someone, in one paragraph.]',
  decision: '[MEASURE: name the hardest decision and what it gave up.]',
  gotWrong: '[MEASURE: state what you got wrong. §8.1 requires this — a front door without it is not conforming.]',
});

/** Collapse a heading to a comparable form. */
function normaliseHeading(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '');
}

/**
 * Parse `product-notes.md` into the four front-door elements.
 *
 * Sections are delimited by markdown headings. Body text is joined with single
 * spaces so a paragraph wrapped across source lines renders as one paragraph —
 * the author's line breaks are a source-formatting choice, not content.
 */
export function parseFrontDoor(markdown: string, fallbackTitle: string): FrontDoor {
  const lines = markdown.split('\n');

  let title = fallbackTitle;
  const sections = new Map<string, string[]>();
  let current: string | undefined;

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);

    if (heading !== null) {
      const level = heading[1]?.length ?? 0;
      const text = heading[2] ?? '';

      // The first h1 is the title, not a section.
      if (level === 1 && title === fallbackTitle) {
        title = text.trim();
        current = undefined;
        continue;
      }

      const normalised = normaliseHeading(text);
      current = undefined;
      for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
        if (aliases.includes(normalised)) {
          current = key;
          sections.set(key, []);
          break;
        }
      }
      continue;
    }

    if (current !== undefined && line.trim().length > 0) {
      sections.get(current)?.push(line.trim());
    }
  }

  const read = (key: keyof Omit<FrontDoor, 'title'>): string => {
    const body = sections.get(key)?.join(' ').trim();
    return body !== undefined && body.length > 0 ? body : MISSING[key];
  };

  return {
    title,
    problem: read('problem'),
    decision: read('decision'),
    gotWrong: read('gotWrong'),
  };
}

/** True when any required element is still a placeholder. */
export function isIncomplete(front: FrontDoor): boolean {
  return [front.problem, front.decision, front.gotWrong].some((v) => v.startsWith('[MEASURE:'));
}

/** Which elements are missing, for the build report. */
export function missingElements(front: FrontDoor): readonly string[] {
  const out: string[] = [];
  if (front.problem.startsWith('[MEASURE:')) out.push('the problem');
  if (front.decision.startsWith('[MEASURE:')) out.push('the hardest decision');
  if (front.gotWrong.startsWith('[MEASURE:')) out.push('what you got wrong');
  return out;
}
