# The Preview Standard

**A standard for evidencing product work that has no market signal.**

| | |
|---|---|
| Version | 0.1.0 (draft — not yet ratified by external review) |
| Status | Draft. Normative language is binding on conforming implementations, but the standard has not yet survived adversarial review by hiring practitioners. Expect breaking changes before 1.0.0. |
| Date | July 2026 |
| Licence | `[OPEN: CC-BY-4.0 proposed for the standard, MIT for the reference renderer. Owner: author. Needed by: week 9. Tracked as Q-6.]` |
| Companion document (in repo) | `SPEC-preview-build-v1.md` — the reference implementation's build specification |
| Note on independence | This standard is written to be implementable from this document alone (§12.2). It references no private document, and a forker needs nothing beyond what is in this repository. |

---

## 0. How to read this document

This standard exists to answer one question: **when someone has built something that has no users, no revenue, and no growth curve, what can they honestly claim about their own judgment, and how does a reader check it?**

It is written for two audiences at once, and the split matters.

An **author** reads it to find out what to produce and what they are allowed to claim. An author who only reads §2, §3, and §7 has enough to comply at the minimum conformance level.

A **reviewer** — someone deciding whether to hire, fund, or collaborate with the author — reads it to find out what the tier next to a claim actually means, and critically, what it does *not* mean. §9 is written for that reader and is the most important section in the document for them.

### 0.1 Conformance language

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are used as in RFC 2119.

- **MUST** — a conforming portfolio violates the standard if it does otherwise. Renderers enforce this mechanically where they can.
- **SHOULD** — strongly recommended. Deviation is permitted but must be visible, not silent.
- **MAY** — genuinely optional.

### 0.2 What this standard is not

It is not a certification. There is no badge, no score, no credential granted by anything. A conforming portfolio is one that follows the rules below; nothing and nobody attests that the underlying work was good. That judgment belongs to the reader, and this standard exists to give them the material to make it, not to make it for them.

It does not verify content. It verifies *structure*, and §9 states the boundary of that verification precisely. A standard that implies more checking than it performs would be committing the exact fault it exists to prevent.

---

## 1. Design principles

Five principles. Every rule in this document derives from one of them, and where a rule seems arbitrary, the principle is the justification.

**P1 — A claim is capped by the artifact behind it.** Anyone can write a number. The standard's entire value is that a claim cannot render above what the evidence in the repository supports. This is the load-bearing property. If it fails, nothing else here is worth anything.

**P2 — A well-measured failure is a good outcome.** A project where someone defined success, measured honestly, found the thing did not work, and said so plainly demonstrates more than an unmeasured shipped feature. This is not encouragement. It is a structural anti-fabrication mechanism: once publishing failure is legitimate, most of the incentive to invent success disappears.

**P3 — Structure, never certify.** The standard defines shapes for evidence. It does not grade. A signal is a link to an artifact, and a fabricated artifact is visible as fabricated the moment a reader clicks it. Verification is delegated to the reader and made cheap for them.

**P4 — Fail down, never up.** On any ambiguity, missing artifact, or unresolvable reference, a claim renders at a *lower* tier than declared. Under-crediting an honest author is an annoyance they fix in minutes. Over-crediting anyone is the standard failing at its only job.

**P5 — State the boundary loudly.** Where the standard cannot check something, it says so in the published output, not only in the specification. Hiding the limits of verification is the failure mode most likely to discredit the whole thing.

---

## 2. The evidence ladder

Every claim in a conforming portfolio MUST carry exactly one tier from this ladder.

| Tier | What it rests on | Needs users? |
|---|---|---|
| **E0** | An assertion, hypothesis, or plan. No supporting observation. | No |
| **E1** | A single anecdote, instance, or self-report. | No |
| **E2** | Coded qualitative work, with `n` stated, method described, and unprompted mentions counted separately from prompted ones. | People to talk to, not users |
| **E3** | Offline evaluation against a frozen, version-pinned test set with documented provenance. | No |
| **E4** | Before-and-after measurement on instrumented real usage, with a stated denominator. | Yes |
| **E5** | Controlled comparison with named arms and per-arm `n` sufficient to support the conclusion drawn. | Yes, at volume |

Tiers are **ordered**: E0 < E1 < E2 < E3 < E4 < E5. This ordering is used for the capping rule in §7 and MUST be treated as a total order by implementations.

### 2.1 Why E3 is the centre of gravity

The ladder's shape encodes a claim that is worth stating explicitly, because it is the reason this standard exists at all.

**E3 is fully reachable with zero users, and it is both rarer and harder to fabricate than E4.** A rigorous offline eval against a frozen set with pinned provenance is more credible evidence of judgment than a dashboard of unaudited usage numbers, because the eval's inputs are inspectable and the dashboard's are not.

This inverts the usual assumption that market evidence outranks everything. It does not, for the specific question of whether someone can tell good from bad. A candidate who cannot get users can still demonstrate, at E3, that they know what good means and can measure whether they achieved it.

`[OPEN: whether hiring practitioners recognise E3 evidence unprompted, or need the ladder explained to them first. This materially changes how a conforming portfolio should present its front door. Owner: author, via practitioner interviews. Needed by: week 4. Tracked as Q-3.]`

### 2.2 Tier is a property of a claim, not of a project

A single project will carry claims at many tiers simultaneously. A problem statement at E0, a discovery finding at E2, an eval result at E3. Portfolios MUST NOT present a single aggregate tier for a whole project, and renderers MUST NOT compute one. Aggregation destroys exactly the information the ladder exists to carry, and an aggregate is one step away from a score, which P3 forbids.

---

## 3. Signals

A signal is a demonstrable act of product judgment. Signals are what a reviewer is actually looking for; tiers describe how well-evidenced each one is.

There are two families, and **the distinction between them MUST be preserved visually in any rendered output** (§8.3). Collapsing them would misrepresent how much of the standard is mechanically enforced.

### 3.1 Evidence signals (S1–S8)

These are tiered by artifact presence. A renderer can mechanically check whether the artifact exists and has the required shape.

| # | Signal | Evidencing artifact | Lowest tier at which it can be claimed |
|---|---|---|---|
| **S1** | Framed a problem as a cost borne by a user, with non-goals written down | `problem-frame.md` | E0 |
| **S2** | Made contact with the population and found something that contradicted the prior | Discovery synthesis with unprompted-mention counts | E2 |
| **S3** | Defined what good means *before* building | Failure taxonomy derived from real outputs | E3 |
| **S4** | Built a fixed test set with documented provenance | `golden/vN.jsonl` + provenance README | E3 |
| **S5** | Established a baseline before changing anything | Dated baseline record with `golden_set_sha` | E3 |
| **S6** | Made a decision with rejected options and accepted cost recorded | Decision record | E0 |
| **S7** | Re-measured and reported what moved, including regressions | Results write-up | E3 |
| **S8** | Bounded conclusions to what `n` supports | Limits section within any of the above | n/a |

**S8 carries the most differentiating weight.** Nearly every candidate lists findings. Almost nobody states the conditions under which their findings would not hold. An author who writes "at n=5 this supports a directional read and nothing stronger" has demonstrated something no volume of findings can substitute for.

S8 has no tier of its own because it is a property of how other claims are written rather than a separate artifact.

### 3.2 Judgment signals (J1–J4)

These concern decisions about *whether and where* to apply AI at all. They cannot be tiered by artifact presence, because no file proves that someone understood a cost asymmetry.

| # | Signal | What it requires |
|---|---|---|
| **J1** | Named where the model makes a contestable judgment, and which error direction costs more | An identified decision point, both error types named, and an argued asymmetry |
| **J2** | Mapped model confidence to interface behaviour | A stated rule connecting confidence bands to what the user sees or is allowed to do |
| **J3** | Workflow arithmetic — steps before vs. after, plus verification cost, and where break-even sits | An explicit count, including the cost of checking the model's output |
| **J4** | Made a decision where AI was rejected or removed | A decision record where the accepted alternative is non-AI |

**Judgment signals are honour-system signals.** The standard applies a *structural* validator only: a J-claim MUST name a live alternative and an accepted cost. That check confirms the claim has the shape of a real decision. It cannot confirm the decision was actually made, or made for the stated reason.

This distinction is not a weakness to be minimised. It is a fact about what is checkable, and §9 records it as such.

`[OPEN: whether J4 in particular is claimable by projects that never seriously considered rejecting AI. A standard that defines a signal its own reference implementations cannot legitimately claim has a credibility problem it should resolve before publication rather than after. Owner: author. Needed by: week 4.]`

### 3.3 Not applicable is a valid state

A project with no model surface cannot reach S3, S4, S5, or S7 by way of evals, and MUST mark them **not applicable** rather than **missing**.

This rule exists to prevent a specific bad outcome: a checklist that punishes non-AI projects pushes authors to bolt a chatbot onto something in order to earn signals. That is precisely the behaviour §1 P2 and P3 are designed to eliminate.

Renderers MUST render `not applicable` and `missing` with visibly different treatment.

---

## 4. Artifact schemas

### 4.1 Front matter

Every artifact making a claim MUST carry YAML front matter.

```yaml
---
signal: S7                    # required — S1..S8 or J1..J4
tier: E3                      # required — declared tier, treated as a claim
n: 120                        # required for E2+; the denominator
date: 2026-09-14              # required — ISO 8601
visibility: redacted          # required — public | redacted | unlisted | private
provenance: "frozen golden set v1, 24 held out"   # required for E3+
versions:                     # required for E3+ where a model is involved
  model: claude-sonnet-4-5
  prompt: v3
  retrieval: rerank-v2
golden_set_sha: 9f2c1a...     # required for E3+
retrospective: false          # required — see §6
anchor: null                  # required when retrospective is true — see §6.2
---
```

**A declared tier is an assertion to be checked, never a value to be read and rendered.** This is the single most important sentence in §4. Implementations that read `tier:` and render it directly are non-conforming regardless of what else they do correctly.

### 4.2 Repository layout

A conforming repository MUST place artifacts at these paths.

```
docs/product/
├── problem-frame.md              # S1
├── discovery/synthesis.md        # S2
├── metrics.md
├── decisions/0001-<slug>.md      # S6, J1–J4
├── results/<date>-<slug>.md      # S7
├── redaction.md                  # required if any artifact is redacted
└── product-notes.md              # the front door (§8)
evals/
├── taxonomy.md                   # S3
├── golden/vN.jsonl               # S4
├── graders/                      # grader definitions
└── baseline-<date>.md            # S5
preview.config.json               # visibility levels, denylist reference
```

Renderers MUST NOT require any path outside `docs/product/`, `evals/`, and `preview.config.json`. The repository is canonical; the rendered site is a projection of it. Authoring MUST NOT occur inside the rendering tool, which makes drift between repository and site structurally impossible rather than merely discouraged.

### 4.3 Required fields per tier

| Tier | Additional requirements beyond the base front matter |
|---|---|
| E0, E1 | None |
| E2 | `n`, `method`, `segment`, and `recruitment` all present and non-trivial |
| E3 | Golden set file exists and is non-empty; baseline record carries a date and `golden_set_sha`; results record's `golden_set_sha` **equals** the baseline's |
| E4 | Instrumentation manifest present; dataset with `n`, a date range, and a stated denominator |
| E5 | Everything E4 requires, plus a comparison spec with named arms and per-arm `n` |

The E3 hash-equality requirement is load-bearing and deserves its own explanation. It is in §5.2.

---

## 5. Anti-fabrication architecture

The rules in this section are the ones an adversarial reviewer should attack first.

### 5.1 What is structurally prevented

**No platform-granted credentials.** No badges, no scores, no rankings. Per P3, the standard structures and never certifies. There is nothing to game because there is no score to move.

**No auto-generated summaries of contribution or value.** In any version, permanently. Model-written summaries of what someone contributed inflate by default. This is the single feature most likely to poison a corpus of portfolios, and it is a permanent exclusion rather than a deferral. Renderers that add it are non-conforming.

**Tier is capped by artifact presence.** §7.

**`[MEASURE: ...]` placeholders render visibly.** If a portfolio is incomplete, it MUST look incomplete. Renderers MUST NOT hide, collapse, or silently omit a placeholder.

### 5.2 Golden set pinning

The highest-value gaming vector available to an author is quietly editing the test set until the number improves.

A conforming portfolio MUST record `golden_set_sha` in both the baseline record and every results record derived from it. If the two hashes differ, the comparison between them is meaningless, and the renderer MUST say so and cap the claim at E1.

This makes the attack **mechanically visible rather than merely discouraged**, which is the correct level of ambition. It does not prevent an author from editing the set and re-recording both hashes honestly — that is a legitimate act, correctly represented as a new baseline rather than a comparison.

### 5.3 What is deterred rather than prevented

Fabricated interviews cannot be detected by anything in the repository. The mitigation is a requirement to state method, segment, and recruitment channel, which is cheap for an honest author and tedious for a fabricator. This is incentive design, not verification, and §9 records it as such.

---

## 6. Retrospective work

Most authors adopting this standard will apply it to work that already exists. That is expected and legitimate. Concealing it is not.

### 6.1 The labelling rule

Any artifact reconstructing reasoning that was not written down at the time MUST set `retrospective: true`, and renderers MUST render a visible flag.

Backdating is the most detectable and most heavily punished thing an author can do, because commit history is public and checking it takes seconds. The standard makes honest reconstruction available specifically so that fabricated chronology has no advantage over it.

### 6.2 Anchoring

A retrospective **decision** claim (S6, J1–J4) MUST cite an anchor: something that predates the reconstruction. A commit, a diff, a deleted branch, a dated message.

Without an anchor, a retrospective decision claim caps at **E0** and renders with a visible unanchored flag.

The reason this rule is stricter for decisions than for measurements is worth stating. Hindsight quietly upgrades every decision into one you reasoned your way to. A reconstructed measurement is either supported by the data or it is not; a reconstructed decision is a story, and stories improve in the retelling without anyone intending to lie.

---

## 7. The capping rule

This is the normative core. One rule, stated once.

> **A claim renders at a tier no higher than the artifacts in the repository can support.**

Formally, for each claim `c`:

```
declared  = c.frontmatter.tier          # untrusted — an assertion
supported = supportedTier(c, repo)      # computed from §4.3
rendered  = min(declared, supported)

if declared > supported:
    warn(c, declared, supported, missingRequirements)
emit(c, rendered, provenanceReference)
```

Conforming implementations MUST:

- Take the **minimum** of declared and supported. Never the declared value alone.
- **Warn, not fail**, when a declaration exceeds support. Failing the build punishes the author who declared E3 intending to build the eval next week, and pushes people away from the tool entirely. Rendering down keeps them moving while making the gap visible.
- **Never silently upgrade.** There is no condition under which a claim renders above its declared tier.
- Render down on *any* ambiguity, missing artifact, unresolvable reference, or internal error (P4).

### 7.1 Diagnostics

A build MUST produce a diagnostics report listing every claim where `declared > supported`.

`[OPEN: whether the diagnostics report should be publishable. Rendering "this author declared E3 and supported E1" publicly would be a strong integrity signal and an equally strong disincentive to adopt the standard at all. Current position: diagnostics are private to the author. Held loosely — this is a question for external reviewers rather than one the author should settle alone. Owner: author + practitioner review. Needed by: week 8.]`

---

## 8. Presentation requirements

The standard constrains rendered output in a small number of places where presentation carries evidentiary meaning.

### 8.1 The four-minute front door

The landing view of a rendered portfolio MUST present, without requiring a scroll past the fold on a desktop viewport:

1. The problem, in one paragraph.
2. The hardest decision made, with its rejected alternative.
3. The headline result, with **tier and `n` attached inline**.
4. What the author got wrong.

Everything else MUST be at most one click away. This is designed for a reviewer who will not scroll twice, and item 4 is not decoration — it is P2 made structurally visible on the first screen.

### 8.2 Regressions carry equal weight

Where results are rendered, regressions MUST receive the same visual weight as improvements. Rendering a regression in a smaller, quieter, or collapsed treatment is non-conforming.

This is a product decision, not a styling one. It follows directly from P2: if failure is a legitimate outcome, it cannot be visually apologised for.

### 8.3 Required disclosures in rendered output

Rendered output MUST include, reachable from the front door:

- The **verification boundary table** (§9), or a link to this standard's copy of it.
- A **visual separation** between evidence signals (S1–S8) and judgment signals (J1–J4), with the honour-system nature of the latter stated in the output itself, not only here.
- **Dates and version tags** next to every metric. These MUST NOT be suppressible by configuration. An eval result from a model version that has been dead eighteen months is a different claim from a current one.

### 8.4 Degradation

Eval charts MUST degrade to legible summary text below narrow breakpoints rather than shrinking. Reviewers read on phones.

---

## 9. What this standard does and does not verify

**This table MUST be reproduced in any conforming rendered output**, per P5 and §8.3. A product that implies more verification than it performs is doing the thing this standard exists to prevent.

| Property | Verified? | How, or why not |
|---|---|---|
| A declared tier is supported by artifacts of the required shape | **Yes** | Mechanical. §7. |
| A golden set was unchanged between baseline and result | **Yes** | Hash equality. §5.2. |
| A redacted artifact declares what was withheld | **Yes** | Build fails without `redaction.md`. §10. |
| Retrospective work is labelled as such | **Partly** | The flag is enforced; the honesty of setting it is not. |
| A retrospective decision cites a pre-existing anchor | **Partly** | Anchor presence is checked; anchor authenticity is not. |
| Interview transcripts describe real conversations | **No** | Nothing in a repository can attest to this. Mitigated by requiring method, segment, and recruitment channel. |
| The golden set represents real inputs | **No** | Representativeness is not decidable from the file. Mitigated by requiring a provenance README rendered next to results. |
| Reported numbers came from the run they claim | **No** | The number is typed by a human. Incentive design only. |
| A model grader is valid | **No** | Requires judgment. Mitigated by requiring judge–human agreement to be stated where a model grader is used. |
| The failure taxonomy was derived from real outputs | **No** | Not decidable. |
| The work was any good | **No** | Explicitly out of scope. That is the reader's judgment to make. |

The bottom four rows are the load-bearing limitations. A reviewer should read them as the honest boundary of what a tier badge means.

---

## 10. Visibility and redaction

Most real product work is confidential. This is a large part of why experienced practitioners have weak public portfolios and why a code repository cannot serve as one. The standard treats visibility as a **core primitive**, not a setting.

### 10.1 Levels

| Level | Behaviour |
|---|---|
| `public` | Renders normally. |
| `redacted` | Renders with specified content withheld. **Requires a sibling `redaction.md`.** |
| `unlisted` | Builds to a non-guessable path, stable across rebuilds, excluded from any index. |
| `private` | **MUST NOT enter the build pipeline at all.** |

### 10.2 Filtering happens before parsing

Private content MUST be filtered at ingest, before any parsing or rendering occurs. Any design where private content is loaded and then hidden by styling or a client-side flag is a leak waiting to happen: the output is static files on a public host, and "hidden" in that context means "present in the HTML".

### 10.3 Redaction statements are rendered, not hidden

A redacted artifact MUST carry a `redaction.md` stating what was withheld and why, and that statement MUST be rendered rather than suppressed.

This is a deliberate inversion. **The way an author handles a confidentiality constraint is itself a signal worth seeing.** A redacted case study retains most of its evidentiary value, because the taxonomy, the decision reasoning, and the *relative* movement in metrics all survive redaction intact. "Pass rate moved from 58% to 79% on a 120-case set" communicates nearly everything without naming anyone.

### 10.4 Methods-only artifacts

Where an agreement permits no metrics at all, the standard supports a **methods-only** artifact: taxonomy structure and decision reasoning with no numbers, tiered honestly at E0 or E1. Weak evidence, but not nothing, and honestly labelled.

---

## 11. Conformance levels

A resolution of the question of whether eight signals is too many to be worth the effort.

| Level | Requires | Intended for |
|---|---|---|
| **Minimum** | S1, S6, S8 + §5 anti-fabrication + §6 retrospective labelling + §9 disclosure | An author with a completed project and limited time. Honest, cheap, and genuinely useful. |
| **Standard** | Minimum + S2 + at least one of S3/S4/S5/S7, or explicit `not applicable` for all four | The expected default. |
| **Full** | All applicable S1–S8, plus any claimed J1–J4 | A project used as a reference implementation of the standard. |

A portfolio MUST declare its conformance level. Renderers MUST NOT compute or display a level the author has not declared, and MUST NOT rank levels against each other in output.

**Minimum is a legitimate destination, not a failure to reach Full.** S1, S6, and S8 alone — a framed problem, a decision with its rejected alternative, and conclusions bounded to what `n` supports — already demonstrate more than most portfolios. The higher levels add evidentiary strength, not virtue.

`[OPEN: whether Minimum as defined stays honest at its lower cost, or whether dropping S2 permits a portfolio that reads as rigorous while never having contacted anyone. Owner: author + reviewers. Needed by: week 4. Tracked as Q-4.]`

---

## 12. Versioning and governance

### 12.1 Version policy

The standard uses semantic versioning.

- **Major** — a change that makes a previously conforming portfolio non-conforming.
- **Minor** — new optional signals, new conformance levels, clarifications that do not invalidate existing portfolios.
- **Patch** — editorial only.

A portfolio MUST declare the standard version it targets. Renderers MUST support the declared version or refuse to build, and MUST NOT silently apply a different version's rules.

`[OPEN: migration path for portfolios written against v0.x once v1.0 lands. A migration tool costs work now and avoids abandonment later; no migration means early adopters are stranded by the first breaking change, which is a poor reward for adopting early. Undecided. Owner: author. Needed by: before 1.0.0.]`

### 12.2 Governance and independence

The standard MUST remain forkable and MUST NOT depend on any service, domain, or account controlled by its author. A standard that dies when its author's hosting lapses was never a standard.

This requirement outranks adoption. A forkable standard with low usage has succeeded on this axis; a widely used one with a single point of failure has not.

**Decided (v0.1): the standard governs any implementation.** Where a renderer's behaviour and this document disagree, the renderer is wrong. An implementation MUST NOT enforce a rule this document does not state, and MUST NOT rely on a behaviour not derivable from it.

This is decided rather than left open because a build cannot start without it, and because the alternative decays predictably: the tool's behaviour quietly becomes the real specification and this document degrades into description. That decay is specifically fatal to §12.2 — a second implementation must be constructible from this document alone.

`[OPEN: the governance *process* remains undecided — who may approve a change to this document once there is more than one implementation or more than one author. The precedence rule above does not answer that. Owner: author. Needed by: week 9. Tracked as Q-5.]`

---

## 13. Open questions in this standard

Consolidated for review. Each is a genuine gap, not a rhetorical device.

| ID | Question | Blocks | Owner | Needed by |
|---|---|---|---|---|
| SQ-1 | Do reviewers recognise E3 evidence unprompted, or must the ladder be explained first? | Front-door design (§8.1) | Practitioner interviews | Week 4 |
| SQ-2 | Is Minimum conformance (§11) honest at its lower cost? | Publication of §11 | Author + reviewers | Week 4 |
| SQ-3 | Should the diagnostics report be publishable? | §7.1 | Practitioner review | Week 8 |
| SQ-4 | Can J4 be legitimately claimed by the standard's own reference implementations? | Credibility of §3.2 | Author | Week 4 |
| SQ-5 | Migration path across major versions | §12.1 | Author | Before 1.0.0 |
| SQ-6 | Who may approve changes to this standard once there is a second implementation or author? (Precedence itself is decided in §12.2.) | §12.2 | Author | Week 9 |
| SQ-7 | Licensing split between standard and renderer | Front matter | Author | Week 9 |
| SQ-8 | Can a reviewer describe an undetectable way to fake any signal? | Publication | Adversarial review | Before 1.0.0 |

**SQ-8 is a kill criterion for individual signals.** If a reviewer can describe how to fake a signal invisibly, that signal is removed before publication rather than patched afterwards.

---

## Appendix A — Minimum conforming portfolio

The smallest thing that conforms, for an author who wants to start today.

```
docs/product/
├── problem-frame.md      # S1, tier E0, retrospective: true, anchored
├── decisions/0001-x.md   # S6, tier E0, names rejected option + accepted cost
└── product-notes.md      # front door; S8 limits section; §9 table linked
preview.config.json       # conformance: minimum
```

Four files. No evals, no interviews, no metrics. Every claim at E0, honestly labelled, with conclusions bounded and the verification boundary disclosed. This conforms, and it is more honest than most portfolios that look far more impressive.
