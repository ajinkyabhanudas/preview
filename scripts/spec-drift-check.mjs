#!/usr/bin/env node
/**
 * Spec drift sentinel.
 *
 * The specification files in spec/ carry named normative properties that the
 * code and the CI gates depend on. A well-meaning edit can silently delete a
 * quality bar, a MUST, or an exit condition, and nothing else in the build
 * would notice — the tests would still pass, because the tests assert on code,
 * not on the document the code claims to implement.
 *
 * This script asserts those properties still exist. It is deliberately crude:
 * it checks for presence of load-bearing text, not for meaning.
 *
 * Exit 0 = all sentinels present. Exit 1 = a normative property vanished.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Each sentinel names a property that must survive any edit.
 * `why` is printed on failure so the person who broke it knows what they broke.
 */
const SENTINELS = [
  {
    file: 'spec/standard-v0.1.md',
    needle: 'no higher than the artifacts in the repository can support',
    why: 'The capping rule (§7) is the entire product claim. Without it the standard asserts nothing.',
  },
  {
    file: 'spec/standard-v0.1.md',
    needle: 'an assertion to be checked, never a value to be read and rendered',
    why: 'Front matter must be treated as untrusted (§4.1). Losing this invites implementations that read tier: and render it.',
  },
  {
    file: 'spec/standard-v0.1.md',
    needle: 'MUST NOT enter the build pipeline',
    why: 'Private artifacts must be filtered before parsing (§10.1). Losing this permits hide-at-render, which leaks.',
  },
  {
    file: 'spec/standard-v0.1.md',
    needle: 'What this standard does and does not verify',
    why: 'The verification boundary table (§9) must exist and be reproduced in output. Implying more verification than performed is the fault the standard exists to prevent.',
  },
  {
    file: 'spec/standard-v0.1.md',
    needle: 'No auto-generated summaries',
    why: 'Permanent exclusion (§5.1). This is the feature most likely to poison the corpus.',
  },
  {
    file: 'spec/standard-v0.1.md',
    needle: 'the standard governs',
    why: 'Precedence (§12.2). Without it the renderer becomes the de-facto specification and the standard decays into description.',
  },
  {
    file: 'spec/build-v1.md',
    needle: 'B4 is a hard gate',
    why: 'Build order (§2). If rendering may begin before the resolver is proven, the project ships a nice site over an unverified invariant.',
  },
  {
    file: 'spec/build-v1.md',
    needle: 'resolves to **E0**, never to the declared value',
    why: 'Resolver fails closed (§3.4). Failing open means an internal bug grants whatever the author claimed.',
  },
];

/** Source-level sentinels: properties that must remain true of the code. */
const CODE_SENTINELS = [
  {
    file: 'src/tier.ts',
    needle: 'export function minTier',
    why: 'The capping rule must remain a single named function that can be property-tested.',
  },
  {
    file: 'tests/property/tier.test.ts',
    needle: 'PROPERTY 3 — monotonicity',
    why: 'Monotonicity catches validation bugs that silently degrade unrelated claims. Example tests do not find these.',
  },
];

let failures = 0;

for (const { file, needle, why } of [...SENTINELS, ...CODE_SENTINELS]) {
  const path = join(ROOT, file);

  if (!existsSync(path)) {
    console.error(`FAIL  ${file} — file is missing entirely`);
    console.error(`      ${why}\n`);
    failures += 1;
    continue;
  }

  const content = readFileSync(path, 'utf8');
  if (!content.includes(needle)) {
    console.error(`FAIL  ${file}`);
    console.error(`      missing: "${needle}"`);
    console.error(`      ${why}\n`);
    failures += 1;
  }
}

const total = SENTINELS.length + CODE_SENTINELS.length;

if (failures > 0) {
  console.error(`${failures}/${total} spec sentinels failed.`);
  console.error('A normative property was removed. Either restore it, or update this');
  console.error('sentinel deliberately in the same commit with a reason in DECISIONS.md.');
  process.exit(1);
}

console.log(`spec-drift: ${total}/${total} sentinels present.`);
