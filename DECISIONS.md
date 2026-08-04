# Decisions

Architecture and product decisions for Preview, with the rejected options and
the accepted cost recorded.

This file is S6 evidence under the standard this repository specifies
(`spec/standard-v0.1.md` §3.1). It is written to the same bar it asks of
anyone else: every entry names what was rejected and what the choice costs.
An entry that records only the choice is not a decision record, it is an
announcement.

**Format.** Each entry: context, the options considered, the decision, the
accepted cost, and a reversal condition. The reversal condition is the field
most often skipped and the most useful one — it converts a decision into
something falsifiable.

**Status key.** `ACTIVE` — in force. `SUPERSEDED` — replaced, with a pointer.
`REVISIT` — in force but with a named trigger to re-open.

---

## D1 — The renderer is a pure, deterministic function

**Status:** ACTIVE · 2026-07 · Inherited from the technical design (ADR-001)

**Context.** The renderer reads a repository and produces a static site. It could
read the clock, fetch avatars, call an API for summaries, or run as a server.

**Options considered.**

1. A conventional static site generator that reads the clock and the network.
2. A server-side application.
3. A pure function with an injected clock, no network, no environment reads.

**Decision.** Option 3.

**Why not the others.** A conventional generator makes reproducible builds
impossible, which forecloses golden-file testing and means a reviewer can never
rebuild a site and confirm it matches. A server-side application introduces
operational load — a database, uptime, someone to page — that a solo part-time
author cannot carry and that the product does not need.

**Accepted cost.** A slightly awkward clock injection. No build-time convenience
features: no fetching a GitHub avatar, no pulling a live star count. The
charting approach is constrained to libraries that emit SVG from data with no
runtime dependency.

**What it buys.** Reproducible builds. Cheap golden-file tests. And a hosting
migration that is a deployment change rather than a rewrite — a pure function is
the same function on a laptop or behind a queue.

**Honest note.** The third benefit is the actual motivation. The other two are
real, but a clock read would have been accepted if hosting were not a live
possibility.

**Reversal condition.** A requirement for server-side personalisation. That
would break purity and reintroduce every operational concern this avoids, and
the technical design should be closed rather than amended.

---

## D2 — Fail closed on tier ambiguity

**Status:** ACTIVE · 2026-07 · Inherited (ADR-002)

**Context.** An author declares `tier: E3` in front matter and the supporting
artifacts are absent. The build must do something.

**Options considered.**

1. Fail the build on any mismatch.
2. Render at the declared tier and warn.
3. Render **down** to the supported tier and warn.

**Decision.** Option 3.

**Why not the others.** Option 1 punishes the optimistic author — the person who
declared E3 intending to build the eval next week — for a drafting error, and
pushes people away from the tool entirely. Option 2 is the product failing at the
only thing it promises: it publishes a claim the evidence does not support.

**Accepted cost.** An author can ignore warnings indefinitely. Accepted, because
the *rendered output* is already honest — the warning is for the author's
benefit, not the reader's protection.

**Reversal condition.** Evidence that authors are systematically ignoring
warnings *and* that this materially misleads readers. The second half matters:
ignored warnings alone are not harmful under this design.

---

## D3 — Visibility filtering at ingest, not at render

**Status:** ACTIVE · 2026-07 · Inherited (ADR-003)

**Context.** Private artifacts must not reach the output bundle.

**Options considered.**

1. Filter at render — simpler, one traversal.
2. Filter at ingest, before any parsing.

**Decision.** Option 2.

**Why not option 1.** It means private content exists in memory alongside output
construction, and one bug puts it in the bundle. The output is static files on a
public host; "hidden" in that context means "present in the HTML". This is not a
hypothetical — hide-at-render is how most confidentiality leaks in static sites
actually happen.

**Accepted cost.** A slightly awkward two-pass structure.

**Reversal condition.** None foreseen. This is a security boundary and should be
treated as fixed.

---

## D4 — Hash-pin golden sets across baseline and results

**Status:** ACTIVE · 2026-07 · Inherited (ADR-005)

**Context.** The highest-value gaming vector available to an author is quietly
editing the test set until the number improves.

**Options considered.**

1. Trust the author's version string (`golden set v2`).
2. Require a content hash recorded in both baseline and results.

**Decision.** Option 2.

**Why not option 1.** A version string is a claim. A hash is a fact. An author
can relabel a file; they cannot relabel its contents.

**Accepted cost.** Authors must record a hash, which is friction. Mitigated by
`preview hash` in the CLI — a rule that depends on someone computing a SHA by
hand will be complied with badly.

**What it does not do.** It does not prevent editing the set. It makes an edit
between baseline and result *visible*, and caps the affected claim at E1.
Detection rather than prevention is the correct ambition here.

---

## D5 — No model inference anywhere in the pipeline

**Status:** ACTIVE · 2026-07 · Inherited (ADR-006) · **Permanent**

**Context.** Writing a good summary is the hardest part of using this standard.
A model could generate the front-door summary from the artifacts.

**Options considered.**

1. Model-generated summaries for the front door.
2. Model-assisted drafting with human confirmation.
3. No model inference at any stage.

**Decision.** Option 3, permanently, in every version.

**Why not the others.** Model-written summaries of someone's contribution inflate
by default. The product's entire asset is that claims are capped by evidence, and
this is the single feature most likely to poison a corpus of portfolios. Option 2
does not survive contact with reality — confirmation becomes rubber-stamping when
the draft is already written and plausible.

**Accepted cost.** The hardest part of the standard stays hard. This is the one
place where the most useful feature and the core principle point in opposite
directions, and the principle wins.

**Reversal condition.** None. This is a permanent exclusion, not a deferral, and
`scripts/spec-drift-check.mjs` asserts the standard still says so.

---

## D6 — The standard governs the renderer

**Status:** ACTIVE · 2026-08 · New in this repository

**Context.** The product requirements left open whether the standard governs the
renderer or whether the two may drift. A build cannot start without an answer.

**Options considered.**

1. The renderer's behaviour is authoritative; the standard describes it.
2. They are peers, reconciled per release.
3. The standard governs; where they disagree, the renderer is wrong.

**Decision.** Option 3.

**Why not the others.** Option 1 is the default decay path for every
specification with one author and one implementation: the tool becomes the real
spec and the document degrades into marketing. That is specifically fatal here,
because the standard must be forkable and a second implementation must be
constructible from the document alone (`spec/standard-v0.1.md` §12.2). Option 2
sounds balanced and means nobody is responsible for the divergence.

**Accepted cost.** Changing renderer behaviour requires a spec change first,
which is slower. The renderer may not add a "sensible" validation the standard
does not state, even when it would obviously help — such a check would become
de-facto standard without review.

**Reversal condition.** None expected. If a second implementation appears and the
governance *process* proves unworkable, revisit the process (SQ-6), not the
precedence rule.

---

## D7 — TypeScript with maximum strictness

**Status:** ACTIVE · 2026-08 · New in this repository

**Context.** The resolver reads untrusted YAML front matter and decides what
tier a claim renders at.

**Options considered.**

1. Default `strict: true`.
2. Strict plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
3. A runtime schema validator carrying the whole burden.

**Decision.** Option 2, with runtime parsing at the boundary.

**Why not the others.** Default strict still lets `record[key]` type as
non-optional when it can be `undefined` at runtime — and a silently-undefined
field in a tier check is precisely how a cap gets bypassed. Option 3 alone
leaves the internal model unguarded after parsing.

**Accepted cost.** More explicit undefined handling throughout. Noisier code in
places where the author knows a key exists.

**Reversal condition.** If the strictness produces defensive noise without
catching real defects over a meaningful period, relax
`exactOptionalPropertyTypes` first — but never `noUncheckedIndexedAccess` in the
resolver.

---

## D8 — Property tests, not example tests, on the resolver

**Status:** ACTIVE · 2026-08 · New in this repository

**Context.** The capping rule is the entire product claim. It needs a test
strategy proportional to that.

**Options considered.**

1. Example tests over hand-written cases.
2. Property-based tests over generated input.
3. Both, with properties as the gate.

**Decision.** Option 3. `fast-check`, run as a separate CI job.

**Why not option 1 alone.** An example test proves the cases someone thought of.
The failure that matters is the case nobody thought of granting a tier that was
never earned. Monotonicity in particular — adding an artifact never lowers an
unrelated claim's tier — is essentially never found by example tests and would
erode author trust faster than any visible bug.

**Accepted cost.** Property tests are slower to write and their failures are
harder to read than a named example.

**Why a separate CI job.** When the invariant breaks, the failure must be legible
as "the invariant broke", not as one red dot among two hundred unit tests.

---

## D9 — Spec drift sentinel in CI

**Status:** ACTIVE · 2026-08 · New in this repository

**Context.** The specifications carry named normative properties — MUSTs, quality
bars, exit conditions — that the code and gates depend on. An edit can silently
delete one and every test still passes, because tests assert on code, not on the
document the code claims to implement.

**Options considered.**

1. Rely on review to catch removals.
2. Assert presence of load-bearing text in CI.

**Decision.** Option 2. `scripts/spec-drift-check.mjs`, 10 sentinels.

**Why not option 1.** Single-author project. There is no second reviewer, and
the removals that matter are the ones that look like tidying.

**Accepted cost.** The sentinel is crude — it checks for the presence of text,
not for meaning, and it breaks on legitimate rewording. That is deliberate: a
sentinel failing on a reword forces the author to confirm the property survived
the rewrite, which is exactly the moment worth interrupting.

**Validated on first run.** The sentinel caught a genuine mismatch immediately —
a needle that did not match the standard's actual wording. The check works.

**Reversal condition.** If sentinel maintenance exceeds its value, replace with
a structural check (headings and MUST-count per section) rather than deleting it.

---

## D10 — Node and TypeScript, not Python

**Status:** ACTIVE · 2026-08

**Context.** The renderer needs a language. This choice determines the
distribution mechanism, the test tooling, and the maintenance burden, and it is
expensive to reverse once rendering lands.

**Options considered.**

1. **Python.** Matches Canopy and youk (two of three sibling repositories).
   `hypothesis` is a stronger property-testing library than `fast-check`, and the
   invariant is the entire product. First-class ML ecosystem if graders ever
   become model-backed.
2. **Node + TypeScript.** `npx preview build` runs with no prior install. Better
   static-site tooling.

**Decision.** Node + TypeScript.

**What settled it — the project's own documents.** The deciding question was
whether Preview is eval tooling (which would make it a Python product) or a
document renderer in an AI-adjacent domain. Four independent statements answer
it:

- The discovery interview: *"the metric comes from the host project's own
  measurement rather than the contributor's self report."*
- PRD §5.1: *"a **static generator** that reads `docs/product/` and `evals/`
  … Eval results become **charts**."* Reads and charts, never runs.
- PRD FR-6: *"Nothing is authored inside the renderer. The repo is canonical and
  the site is a **projection** of it."*
- The technical design, out of scope: *"The eval harness itself, which is **user
  owned and out of my trust boundary entirely**."*

**Preview never executes an eval.** It reads a golden set to confirm it is
non-empty and hashes it. It never parses a case, never runs a grader, never
computes a metric. ADR-006 forbids model inference permanently, and the runtime
dependency list is one library (`yaml`).

So Python's strongest argument — the ML and eval ecosystem — has nothing to act
on here. With domain fit neutral, distribution decides, and PRD §5.1 already
specifies `npx preview build`. An installer that requires a working Python
interpreter first is friction against KR 3.1's thirty-minute target.

**Accepted cost.** A second toolchain in the portfolio. `fast-check` is a weaker
property-testing library than `hypothesis`, which matters because the invariant
is the thing being tested — mitigated by testing it at two levels (algebraic in
`tests/property/tier.test.ts`, repository-level in `resolver.test.ts`).

**Reversal condition.** A requirement for the renderer to *execute* rather than
read evals — a `preview eval` command, a grader runtime, any scoring. That would
pull the eval harness inside the trust boundary, which the technical design §12
says means the design should be **closed rather than amended**. It would be a
different product, and Python would be correct for it.

---

## D11 — A local authoring app, not a hosted platform

**Status:** ACTIVE · 2026-08

**Context.** The standard asks an author to produce up to eight artifacts with
correct front matter. Hand-writing those is the dominant cost of adopting it, and
that cost is what H-1 tests: if three external builders will not finish, the
barrier was never presentation, it was effort.

The renderer removing that cost is the product. But FR-6 states that nothing is
authored inside the renderer — the repository is canonical and the site is a
projection of it — and the technical design lists "authoring moving into the
tool" as one of three changes that would **void the design** rather than extend
it.

Those two requirements appear to conflict. They do not, and the resolution is
what this entry records.

**Options considered.**

1. **Hand-authoring only.** The author writes every artifact. Preserves FR-6
   perfectly and almost certainly fails H-1.
2. **Hosted platform.** Accounts, a database, other people's portfolios stored
   on a server.
3. **Local authoring app.** A CLI and a local UI that read the repository,
   extract what already exists, and write markdown files back into the author's
   own repository. No server, no accounts, no database, no network.

**Decision.** Option 3.

**Why not option 2.** Explicitly out of scope in the product requirements
(hosted multi-tenant platform, accounts, auth, database) and gated on H-2 — five
unsolicited hosting requests by week 12. That gate exists precisely so hosting is
decided by evidence rather than enthusiasm, and the operational capacity for it
does not exist: there is nobody to page, and nothing should be able to page.

**Why this does not break FR-6.** The distinction is between *where artifacts
live* and *where they are typed*. FR-6 requires the repository to be canonical —
that the site is a projection of the repository, so the two cannot drift. A local
app that writes `docs/product/*.md` into the author's repository, which the
author then reviews and commits, satisfies that completely. The files are in the
repository. The site is still a projection of them. Nothing is stored anywhere
else, and there is no second source of truth to drift from.

What FR-6 forbids is a tool that *holds* the content — a CMS, a database, a
hosted editor whose state is authoritative and whose export is a copy. This is
not that.

**The line against ADR-006.** Extraction may **copy and structure text that
already exists** in the repository: a decision heading, a benchmark figure, a
test-case count. It may never **write prose about contribution or value**. A
generated artifact is a form filled from files, never a summary composed about
the author. Every extracted field carries its source path so the author can see
exactly where each value came from, and any field the tool could not fill is left
as a visible `[MEASURE: ...]` placeholder rather than guessed.

**Accepted cost.** A UI surface in a project whose technical design says the
build should feel underbuilt. Mitigated by keeping it a static local page with no
framework and no build step of its own — it reads a JSON extraction and writes
files, and it is excluded from the rendered output bundle entirely.

The second cost is real: extraction quality determines whether this helps. A
generated artifact that is wrong is worse than a blank one, because the author
may accept it without reading. This is why nothing is inferred — a field is
extracted from a specific file or left visibly empty.

**Reversal condition.** Evidence that authors accept generated drafts without
reading them, which would make extraction a fabrication vector rather than a
convenience. The test is whether committed artifacts still contain unedited
`[MEASURE: ...]` placeholders in published portfolios.

---

## D12 — Hand-rolled SVG charts, no charting library (resolves OD-1)

**Status:** ACTIVE · 2026-08

**Context.** The renderer draws eval results. D1 requires the build to be a pure
deterministic function: no DOM, no network, no ambient clock. Most charting
libraries assume a browser, measure text against fonts, or emit non-deterministic
identifiers — any of which breaks byte-identical output and therefore breaks
both reproducible builds and golden-file testing.

**Options considered.**

1. **A browser-oriented charting library** (Chart.js, D3 with jsdom). Rejected:
   requires a DOM, and jsdom is a large dependency whose text measurement varies
   with available fonts.
2. **A server-side SVG charting library.** Closer, but every candidate carries
   transitive dependencies, and most generate `id` attributes or gradient
   references from counters or randomness that differ between runs.
3. **Hand-rolled SVG from data.** Two chart types, emitted as strings.

**Decision.** Option 3.

**Why.** The requirement is genuinely small: a per-class before/after bar chart
and a delta chart. That is arithmetic and string concatenation. A library would
add a dependency, a determinism risk, and a supply-chain surface in exchange for
work that is a day.

The constraint also cuts the other way and is worth stating: because charts must
degrade to legible summary text below narrow breakpoints (standard §8.4), the
chart is never the only representation of the data. A library optimising for
interactive richness is optimising for something this product does not want.

**Accepted cost.** Two chart types is the ceiling without more work. Anything
beyond a bar chart — scatter, distribution, time series — is a new
implementation rather than a configuration change. Accepted, because the
standard's results format is per-class pass rates, and that is a bar chart.

**Determinism obligations this creates.** No `Math.random`, no `Date.now`, no
counters that survive between renders. Every element identifier derives from
content. Numbers are formatted with a fixed precision rather than locale
defaults, since locale is an environment read.

**Reversal condition.** A results format that genuinely needs a chart type
outside the bar family. At that point re-evaluate libraries against the same
purity constraint rather than extending the hand-rolled code indefinitely.

---

## Open decisions

Not yet decided. Listed so they are not mistaken for settled.

| ID | Question | Blocked on | Needed by |
|---|---|---|---|
| OD-1 | Charting approach — must satisfy D1 purity with no runtime dependency | Library evaluation | Before B5 |
| OD-2 | Unlisted slug stability across machines — local config vs. content-derived | — | Before B6 |
| OD-3 | Licence for artifacts archived into the bundle when the source repo differs | — | Before public release |
| OD-4 | Whether the diagnostics report should be publishable | Practitioner review | Week 8 |
| OD-5 | Schema migration path across major standard versions | — | Before 1.0.0 |
