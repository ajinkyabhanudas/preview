#!/usr/bin/env node
/**
 * Status accuracy gate.
 *
 * The README and LIMITATIONS.md make claims about what is built. Those are
 * claims about the code, and nothing was checking them — the README said "the
 * renderer is not built" for four merged pull requests after the renderer was
 * built.
 *
 * On a project whose entire asset is that claims are checkable, a stale status
 * table is the worst class of defect. It is the repository overclaiming in the
 * opposite direction, and a reviewer who verifies it finds the documentation
 * untrustworthy — which is exactly the judgment the standard is trying to earn.
 *
 * Checks:
 *   1. No document claims a pipeline stage is unbuilt when its source exists.
 *   2. LIMITATIONS.md still states the things that remain genuinely unproven.
 *      This direction matters more: quietly dropping a limitation once the code
 *      improves is how an honest document becomes a marketing one.
 *
 * Exit 0 = accurate. Exit 1 = a status claim no longer matches reality.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const STAGES = ['ingest', 'filter', 'validate', 'resolve', 'render', 'emit'];
const failures = [];

/** A stage is built when its directory exists and holds at least one file. */
function isBuilt(stage) {
  const dir = join(ROOT, 'src', stage);
  return existsSync(dir) && readdirSync(dir).length > 0;
}

const built = STAGES.filter(isBuilt);
const unbuilt = STAGES.filter((s) => !isBuilt(s));

// 1. Documents must not claim the renderer is unbuilt once it is.
if (unbuilt.length === 0) {
  for (const file of ['README.md', 'LIMITATIONS.md']) {
    const content = readFileSync(join(ROOT, file), 'utf8');
    for (const phrase of ['renderer is not built', 'The renderer is not built']) {
      if (content.includes(phrase)) {
        failures.push(
          `${file}: says "${phrase}" but all ${STAGES.length} pipeline stages exist ` +
            `(${built.join(', ')})`,
        );
      }
    }
  }
}

/**
 * 2. Limitations that must survive until the work that resolves them is done.
 *
 * Each is paired with the condition that would make removing it honest. A
 * limitation is not resolved by the code improving — it is resolved by the
 * specific evidence arriving.
 */
const MUST_REMAIN = [
  {
    phrase: 'has not survived external review',
    until: 'practitioner interviews have run (validation plan §1)',
  },
  {
    phrase: 'No portfolio has been built with it',
    until: 'a real project has been restructured to the standard',
  },
  {
    phrase: 'The central claim is untested',
    until: 'the comprehension test has run (validation plan §2, H-5)',
  },
];

const limitations = readFileSync(join(ROOT, 'LIMITATIONS.md'), 'utf8');
for (const { phrase, until } of MUST_REMAIN) {
  if (!limitations.includes(phrase)) {
    failures.push(
      `LIMITATIONS.md: no longer states "${phrase}".\n` +
        `      Remove this sentinel only when ${until}.`,
    );
  }
}

if (failures.length > 0) {
  console.error('status-check: FAILED\n');
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    '\nEither correct the document, or update this gate deliberately in the same\n' +
      'commit with a reason. A status claim that drifts is the repository\n' +
      'overclaiming about itself.',
  );
  process.exit(1);
}

console.log(
  `status-check: accurate — ${built.length}/${STAGES.length} stages built, ` +
    `${MUST_REMAIN.length} limitation(s) still stated.`,
);
