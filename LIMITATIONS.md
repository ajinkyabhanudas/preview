# Limitations

What this project does not do, cannot check, and has not yet proven.

> Read this before relying on a Preview-rendered portfolio to evaluate someone.
>
> Last updated: 2026-08-03. Update when a limitation is resolved or a new one is
> found.

This file exists because the standard in `spec/standard-v0.1.md` requires
authors to bound their conclusions to what the evidence supports (S8), and to
publish the boundary of what they verify (§9). A project that asked that of
others while omitting it for itself would fail on its own terms.

---

## 1. Status: nothing here is proven yet

**The renderer is not built.** As of this writing the repository contains the
specification, the domain model (`src/tier.ts`), the property tests that gate the
invariant, and the CI gate scripts. Stages B2–B7 in `spec/build-v1.md` §2 do not
exist.

**The standard has not survived external review.** Version 0.1 has been read by
its author and nobody else. The adversarial review that would justify calling it
a standard rather than a proposal is scheduled, not done.

**No portfolio has been built with it.** Including the author's own.

Anyone evaluating this project today is evaluating a specification and a test
suite, not a working product. That is the honest description.

---

## 2. What the standard cannot verify

Reproduced from `spec/standard-v0.1.md` §9, because it is the most important
thing a reviewer needs and should not require following a link.

| Property | Verified? | Why not |
|---|---|---|
| A declared tier is supported by artifacts of the required shape | **Yes** | Mechanical |
| A golden set was unchanged between baseline and result | **Yes** | Hash equality |
| A redacted artifact declares what was withheld | **Yes** | Build fails without it |
| Retrospective work is labelled | **Partly** | The flag is enforced; the honesty of setting it is not |
| A retrospective decision cites a real anchor | **Partly** | Presence checked; authenticity not |
| Interviews describe real conversations | **No** | Nothing in a repository can attest to it |
| The golden set represents real inputs | **No** | Representativeness is not decidable from the file |
| Reported numbers came from the run they claim | **No** | The number is typed by a human |
| A model grader is valid | **No** | Requires judgment |
| The taxonomy was derived from real outputs | **No** | Not decidable |
| **The work was any good** | **No** | Explicitly out of scope — that is the reader's judgment |

The bottom four rows are load-bearing. A tier badge means "artifacts of this
shape exist", never "this claim is true".

---

## 3. Known gaps in the design

### 3.1 Judgment signals are honour-system

Signals J1–J4 (`spec/standard-v0.1.md` §3.2) concern decisions about whether to
use AI at all. No file proves someone understood a cost asymmetry, so these carry
only a *structural* validator: the claim must name a live alternative and an
accepted cost.

This shifts the ratio of mechanically-enforced signals to honour-system ones,
which weakens the verification claim. The mitigation is that the standard states
the split loudly and requires it be visually separated in rendered output. Hiding
the distinction would be the actual failure.

### 3.2 The author cannot yet claim J4

J4 requires a decision where AI was rejected or removed. It is currently unknown
whether the author's own projects contain a legitimate instance.

**A standard that defines a signal its own reference implementations cannot claim
has a credibility problem.** Unresolved. Tracked as SQ-4.

### 3.3 The segment is n=1

The mechanism this product addresses is well evidenced. The size of the
population is not evidenced at all. The confirmed set of willing builders blocked
specifically on presentation is one person, and that person is the author.

This does not block the work — almost all of the cost is portfolio work the
author needs to do regardless — but it is the largest hole in the premise and is
stated here rather than left for someone to find.

### 3.4 No blind in any validation instrument

The author designs, recruits, runs, and scores every instrument in the validation
plan. There is no independent replication and no blind scoring. Participant
counts are in single digits.

Every result this project produces supports a directional read only.

---

## 4. Deliberately not engineered

Each of these is somewhere a competent engineer would reasonably add something,
and where adding it would consume the available time.

No plugin system. No theming beyond a config file. No incremental builds. No
i18n. No CMS or admin surface. No database. No authentication. No caching layer.
No hosted multi-tenant platform. No collaboration or contribution credit. No
recruiter-side search. No mobile authoring.

The build should feel underbuilt to a reviewer. That is preferred to a
well-engineered system with nothing good rendered in it.

---

## 5. Known weaknesses in the gates

**The leak check is crude.** It is a case-insensitive substring match against a
denylist. It will not catch a paraphrase, an inferable detail, or a screenshot
containing a client name in an image. It is the highest-consequence test in the
suite and it is not sufficient on its own — a human must review any redacted
bundle before publication.

**The spec drift sentinel checks text presence, not meaning.** It breaks on
legitimate rewording and cannot detect a property that was preserved in wording
but gutted in substance.

**Determinism is checked on one fixture.** A build can be deterministic for the
honest-complete fixture and non-deterministic for input the fixture does not
cover.

**Property tests are currently algebraic.** They prove the capping *function*
holds its properties. The repository-level version — that adding a real file to a
real repository never lowers an unrelated claim — activates when the resolver
lands in B4.

---

## 6. What would falsify the project

From the product requirements, restated here because a limitations file that
omitted the kill criteria would be incomplete.

| Hypothesis | Falsified when | Consequence |
|---|---|---|
| Willing blocked builders exist beyond the author | <3 of ≥15 complete a portfolio by week 10 | v2 does not proceed |
| Reviewers comprehend better from the rendered site than the repository | No directional improvement in the comprehension test | **Core value proposition is wrong. Stop and reframe.** |
| Practitioners value E3 evidence | Indifference in structured review | The standard's central insight is wrong |
| The redaction path satisfies a real client agreement | It cannot | The confidentiality wedge closes |

All four outcomes are publishable. Under this project's own standard, a
well-measured failure is a good outcome — and that has to apply to this project
before it can credibly be asked of anyone else.
