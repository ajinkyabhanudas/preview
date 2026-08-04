#!/usr/bin/env node
/**
 * The Preview CLI.
 *
 *   preview init [--docs <dir>]   propose draft artifacts from existing evidence
 *   preview check                 validate without writing output
 *   preview hash <file>           compute a golden-set SHA-256
 *
 * `init` never overwrites. It writes only files that do not exist, and reports
 * what it skipped, because the author's edits outrank anything extracted.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { extract, hashGoldenSet, renderDraft } from './author/extract.js';
import { analyse } from './index.js';

function usage(): void {
  console.log(`preview — evidence for work with no market signal

  preview init [--docs <dir>]   propose drafts from evidence already in the repo
  preview check                 validate claims, write nothing
  preview hash <file>           compute a golden-set SHA-256

init reads the repository (and --docs, if product documentation lives
elsewhere), then writes draft artifacts you review and commit. It never
overwrites an existing file, and never invents a value: anything it cannot
find from a file is left as a visible [MEASURE: ...] placeholder.`);
}

async function cmdInit(repoRoot: string, docsRoot: string | undefined): Promise<number> {
  const report = await extract(repoRoot, docsRoot === undefined ? {} : { docsRoot });

  console.log(`Scanned ${report.scanned.length} file(s) in ${repoRoot}`);
  if (docsRoot !== undefined) console.log(`Also scanned ${docsRoot}`);
  console.log('');

  if (report.drafts.length === 0) {
    console.log('No evidence found to propose drafts from.');
    console.log('This is not a failure — it means the artifacts must be written by hand.');
    return 0;
  }

  let written = 0;
  let skipped = 0;

  for (const draft of report.drafts) {
    const target = join(repoRoot, draft.targetPath);

    if (existsSync(target)) {
      console.log(`  skip   ${draft.signal}  ${draft.targetPath} (already exists)`);
      skipped += 1;
      continue;
    }

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, renderDraft(draft), 'utf8');

    const gapNote = draft.gaps.length > 0 ? `  — ${draft.gaps.length} field(s) need you` : '';
    console.log(`  write  ${draft.signal}  ${draft.targetPath}${gapNote}`);
    written += 1;
  }

  console.log('');
  console.log(`${written} draft(s) written, ${skipped} skipped.`);

  if (report.missing.length > 0) {
    console.log('');
    console.log(`No evidence found for: ${report.missing.join(', ')}`);
    console.log('Signals with no artifact render as explicitly absent, not hidden.');
    console.log('An absent signal is honest. A fabricated one is not.');
  }

  console.log('');
  console.log('Every draft is retrospective and capped at E0 until you supply the');
  console.log('missing fields. Review each one before committing — a draft you did');
  console.log('not read is a claim you did not make.');

  return 0;
}

async function cmdCheck(repoRoot: string): Promise<number> {
  // A fixed clock: `check` must not vary by when it runs (ADR-001).
  const report = await analyse(repoRoot, { clock: new Date(0) });

  console.log(`${report.claims.length} claim(s), ${report.diagnostics.length} diagnostic(s)`);

  for (const claim of report.claims) {
    const capped = claim.rendered === claim.declared ? '' : `  (declared ${claim.declared})`;
    console.log(`  ${claim.rendered}  ${claim.signal}  ${claim.path}${capped}`);
  }

  const errors = report.diagnostics.filter((d) => d.severity === 'error');
  for (const d of report.diagnostics) {
    console.log(`  ${d.severity.toUpperCase()}  ${d.path}: ${d.message}`);
  }

  return errors.length > 0 ? 1 : 0;
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  const repoRoot = resolve(process.cwd());

  switch (command) {
    case 'init': {
      const flag = rest.indexOf('--docs');
      const docs = flag === -1 ? undefined : rest[flag + 1];
      return cmdInit(repoRoot, docs === undefined ? undefined : resolve(docs));
    }
    case 'check':
      return cmdCheck(repoRoot);
    case 'hash': {
      const file = rest[0];
      if (file === undefined) {
        console.error('usage: preview hash <file>');
        return 1;
      }
      const sha = await hashGoldenSet(repoRoot, file);
      if (sha === undefined) {
        console.error(`cannot read ${file}`);
        return 1;
      }
      console.log(sha);
      return 0;
    }
    default:
      usage();
      return command === undefined || command === '--help' ? 0 : 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(String(error));
    process.exit(1);
  });
