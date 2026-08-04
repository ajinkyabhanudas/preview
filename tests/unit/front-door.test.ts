/**
 * Front-door parsing tests — spec/standard-v0.1.md §8.1.
 *
 * The four elements are authored prose. They cannot be extracted and ADR-006
 * forbids composing them, so the only correct behaviour when one is absent is
 * to show it as absent.
 */

import { describe, expect, it } from 'vitest';
import { isIncomplete, missingElements, parseFrontDoor } from '../../src/render/front-door.js';

const NOTES = `# Canopy

## The problem

The science team cannot query the database without an engineer.

## The hardest decision

Read-only SQL over a fine-tuned model. Fine-tuning handled schema quirks
better but made answers unauditable.

## What I got wrong

The first taxonomy was imagined rather than derived from real outputs.
`;

describe('parsing', () => {
  it('reads the title from the first h1', () => {
    expect(parseFrontDoor(NOTES, 'fallback').title).toBe('Canopy');
  });

  it('reads all four elements', () => {
    const front = parseFrontDoor(NOTES, 'fallback');
    expect(front.problem).toContain('cannot query the database');
    expect(front.decision).toContain('Read-only SQL');
    expect(front.gotWrong).toContain('imagined rather than derived');
  });

  it('joins a paragraph wrapped across source lines', () => {
    // Line breaks in the source are formatting, not content.
    const front = parseFrontDoor(NOTES, 'f');
    expect(front.decision).toContain('schema quirks better but made answers');
  });

  it('accepts heading variants', () => {
    const variants = `# T
## Problem
a
## The decision
b
## What went wrong
c
`;
    const front = parseFrontDoor(variants, 'f');
    expect(front.problem).toBe('a');
    expect(front.decision).toBe('b');
    expect(front.gotWrong).toBe('c');
  });

  it('falls back to a supplied title when there is no h1', () => {
    expect(parseFrontDoor('## The problem\nx\n', 'Portfolio').title).toBe('Portfolio');
  });
});

describe('absence is visible, never silent', () => {
  it('renders a placeholder for every missing element', () => {
    const front = parseFrontDoor('# Only a title\n', 'f');
    expect(front.problem).toContain('[MEASURE:');
    expect(front.decision).toContain('[MEASURE:');
    expect(front.gotWrong).toContain('[MEASURE:');
  });

  it('treats an empty section as missing', () => {
    const front = parseFrontDoor('# T\n\n## The problem\n\n## What I got wrong\nx\n', 'f');
    expect(front.problem).toContain('[MEASURE:');
    expect(front.gotWrong).toBe('x');
  });

  it('names what is missing, so the CLI can say so', () => {
    const front = parseFrontDoor('# T\n## The problem\nx\n', 'f');
    expect(missingElements(front)).toEqual(['the hardest decision', 'what you got wrong']);
  });

  it('reports complete notes as complete', () => {
    expect(isIncomplete(parseFrontDoor(NOTES, 'f'))).toBe(false);
    expect(missingElements(parseFrontDoor(NOTES, 'f'))).toEqual([]);
  });

  it('states that "what I got wrong" is required, not optional', () => {
    // §8.1 item 4. Publishable failure is the mechanism that makes fabrication
    // pointless, so the placeholder says so rather than being generic.
    const front = parseFrontDoor('# T\n', 'f');
    expect(front.gotWrong).toContain('§8.1 requires this');
  });
});

describe('robustness', () => {
  it('handles empty input without throwing', () => {
    expect(() => parseFrontDoor('', 'f')).not.toThrow();
    expect(parseFrontDoor('', 'f').title).toBe('f');
  });

  it('ignores unrecognised sections', () => {
    const front = parseFrontDoor('# T\n## Appendix\nnoise\n## The problem\nreal\n', 'f');
    expect(front.problem).toBe('real');
  });

  it('is deterministic', () => {
    expect(parseFrontDoor(NOTES, 'f')).toEqual(parseFrontDoor(NOTES, 'f'));
  });
});
