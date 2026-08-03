# Preview renderer: v1 build specification

**What gets built, in what order, and what must be true before each piece is considered done.**

| | |
|---|---|
| Version | 0.1 (draft) |
| Status | Draft. No code exists. |
| Date | July 2026 |
| Companion document (in repo) | [`standard-v0.1.md`](standard-v0.1.md) — the rules being enforced. Governs this document per §0.1. |
| Upstream documents (not in repo) | Technical design (architecture and ADRs, referenced throughout as "the TDD"), product requirements, and the validation plan. These are the author's private reasoning layer and are deliberately not published. This specification is written to stand alone without them. |

---

## 0. Scope and precedence

This document sits between the TDD and the code. The TDD decided *how the system is shaped*; this decides *what gets built in which order, and what "done" means for each piece*.

### 0.1 Precedence — the governance question

The PRD leaves open whether the standard governs the renderer or whether the two may drift (Q-5, SQ-6). This specification takes a position, because the build cannot start without one:

> **The standard governs. The renderer is one implementation of it, and where they disagree, the renderer is wrong.**

Three consequences that are binding on this build:

1. A renderer behaviour not derivable from the standard is a **bug in one of the two documents**, and the resolution names which. Silent divergence is not permitted.
2. The renderer MUST NOT enforce rules the standard does not state. Convenience checks that "seem sensible" become de-facto standard, unreviewed.
3. When the standard changes, this document changes before the code does.

This inverts the usual relationship, where the tool's behaviour becomes the real specification and the document decays into marketing. That decay is fatal here specifically because the standard is meant to be forkable and to outlive this implementation (§12.2 of the standard). A second implementation must be possible from the standard alone.

### 0.2 In scope

Ingest, filter, validate, resolve, render, emit. The CLI. The test suite. The diagnostics report.

### 0.3 Out of scope

Authoring tools. Any model inference, ever (ADR-006). Search. Multi-tenancy. Anything that stores data. The eval harness, which lives in the author's repository and is outside the trust boundary entirely.

---

## 1. The invariant, restated as an acceptance condition

From TDD §2, and it is the reason this project has a disproportionate amount of design for its line count:

> **A claim renders at a tier no higher than the artifacts in the repository can support.**

Everything else is markdown to HTML. A layout bug costs an afternoon. A tier-resolution bug is a false statement made to someone making a hiring decision, and it discredits every honest portfolio built on the same standard.

**Acceptance condition for v1 as a whole:** the three properties in §5.1 hold under property-based testing over generated repositories. Nothing ships if they do not, regardless of how complete the rest is.

---

## 2. Build order

Ordered by trust concentration, not by what is satisfying to build. The resolver comes before anything renders, because a beautiful site built on an unverified resolver is the failure mode this project is most at risk of.

| Phase | Builds | Done when |
|---|---|---|
| **B1** | Domain model + tier ordering | `Tier` is a total order; `min` is total and tested exhaustively over all 36 pairs |
| **B2** | Ingest + filter | Private artifacts provably never enter the pipeline (§3.2) |
| **B3** | Validate | Schemas per §4.3 of the standard; malformed input degrades, never crashes |
| **B4** | **Resolve** | The three properties in §5.1 hold under property tests. **Gate.** |
| **B5** | Render | Snapshot tests; front door meets §8.1 of the standard |
| **B6** | Emit + archive | Bundle is self-sufficient; leak test passes |
| **B7** | CLI + diagnostics | `npx preview build` runs end to end |

**B4 is a hard gate.** B5 does not begin until B4's property tests pass. This ordering is the main defence against the pre-mortem scenario in PRD §10 where a nice site wraps ordinary work — build the trust machinery first, and the site is constrained by it rather than the other way round.

### 2.1 Sequencing against the calendar

The PRD puts renderer work in weeks 5–6, after weeks 3–4 of restructuring a real project **by hand, with no tooling**.

That ordering is load-bearing and this specification inherits it. You cannot automate a cost you have not personally felt, and building tooling before that point reliably automates the wrong thing. B1–B7 begin in week 5, informed by what the manual pass proved was actually expensive.

---

## 3. Component specifications

### 3.1 Domain model (B1)

```
Tier      = E0 | E1 | E2 | E3 | E4 | E5      -- total order
Visibility = Public | Redacted | Unlisted | Private
Signal    = S1..S8 | J1..J4
Claim     = { signal, declared: Tier, frontmatter, sourcePath }
```

`Tier` MUST be an ordered enumeration with a total `min`. This is four lines of code and it is the foundation of the invariant; it gets exhaustive testing over all 36 ordered pairs rather than spot checks.

**Constraint:** no aggregate tier type exists anywhere in the model. Per §2.2 of the standard, portfolios do not have a tier — claims do. Not representing an aggregate makes computing one impossible rather than merely discouraged.

### 3.2 Ingest and filter (B2)

Ingest is the **only** stage touching the filesystem, which makes every downstream stage testable with in-memory fixtures rather than temporary directories.

Filter runs **immediately after ingest, before any parsing** (ADR-003, §10.2 of the standard).

| Visibility | Behaviour |
|---|---|
| `private` | Dropped at filter. Never parsed, never in memory downstream, never in output. |
| `unlisted` | Included; emitted to a non-guessable path from a slug in local config, stable across rebuilds, excluded from every index and sitemap. |
| `redacted` | Included; **build fails** if sibling `redaction.md` is absent. |
| `public` | Included. |

**Acceptance:** a test asserting that for a repository containing a private artifact with a unique sentinel string, that string appears nowhere in the pipeline's post-filter state or in any output byte. The check is on the *absence of the string from memory downstream*, not just from output — filtering late and hiding at render is the leak this ordering exists to prevent.

The build failure on missing `redaction.md` is deliberate and is the one place the build fails rather than degrades. A redacted artifact with no statement of what was withheld is worse than no artifact: it presents as handled confidentiality while disclosing nothing about what is missing.

### 3.3 Validate (B3)

Parses front matter, checks schemas per §4.3 of the standard, resolves cross-references, verifies hashes. **Emits diagnostics. Never mutates.**

| Input condition | Behaviour |
|---|---|
| Malformed YAML | Degrade that document to E0, report, continue |
| Missing referenced artifact | Claim renders down, warn |
| Cyclic reference | **Error.** Structural mistake, not an incomplete draft |
| `golden_set_sha` mismatch between baseline and results | Render down to E1 with a **prominent** diagnostic |
| Enormous file | Bounded read, report, continue |
| Path traversal in config | Reject, error |

The hash mismatch is the gaming signature (§5.2 of the standard) and MUST NOT be quiet. It is the one diagnostic that gets visual prominence over the others.

### 3.4 Resolve (B4) — the security-relevant stage

One file. No dependencies beyond the validated model. Target: under ~150 lines.

```
for each claim c:
    declared  = c.frontmatter.tier          # untrusted
    supported = supportedTier(c, repo)      # computed
    rendered  = min(declared, supported)

    if declared > supported:
        diagnostics.warn(c, declared, supported, missingRequirements)
    emit(c, rendered, provenanceRef)
```

**Rules binding on this stage:**

- Any error inside `supportedTier` resolves to **E0**, never to the declared value. Failing open here would mean an internal bug silently grants whatever the author claimed — the exact inversion of P4.
- The function is pure. No filesystem, no clock, no environment.
- No path exists by which a rendered tier exceeds a declared tier. This is tested as a property, not an example.

### 3.5 Render and emit (B5, B6)

Deliberately boring. Markdown to HTML, snapshot-tested, low ceremony.

Requirements inherited from §8 of the standard, all of which are **product decisions rather than styling** and MUST NOT be configurable:

- Front door carries problem, hardest decision, headline result with tier and `n` inline, and what the author got wrong — above the fold (§8.1).
- Regressions render at equal visual weight to improvements (§8.2).
- Dates and version tags next to every metric, **not suppressible** (§8.3).
- Evidence signals visually separated from judgment signals, with the honour-system nature of J1–J4 stated in the output (§8.3).
- Verification boundary table (§9) reproduced or linked from the front door.
- `[MEASURE: ...]` renders visibly (§5.1).
- Charts degrade to legible summary text below narrow breakpoints, rather than shrinking (§8.4).

Emit archives referenced artifacts into the bundle (ADR-004) so the site survives the source repository going private. `[OPEN: licence governing copied artifacts when the source repository's licence differs from the site's. Probably a note in the standard rather than code. Tracked as Q-E3.]`

### 3.6 CLI (B7)

```
npx preview build     # repo -> bundle + diagnostics
npx preview check     # validate only, no output, non-zero exit on error
npx preview hash      # compute golden_set_sha for the author
```

`preview hash` exists because ADR-005 requires authors to record hashes, and a rule that depends on someone computing a SHA by hand will be complied with badly.

---

## 4. Determinism

`render :: (RepoSnapshot, Config, BuildClock) -> (SiteBundle, Diagnostics)`

Pure. Same inputs produce **byte-identical** output. No network at any stage, no ambient clock, no environment reads. The clock is injected rather than read, because §8.3 of the standard requires dates next to metrics and reading the system clock would break both reproducible builds and golden-file testing.

**Acceptance:** building the same fixture twice produces identical bytes. Runs in CI.

`[OPEN: whether the pure-function constraint survives chart rendering. If the charting library needs a DOM or fetches fonts at build time, determinism gets harder. Resolve in week 5 by selecting a library that emits SVG from data with no runtime dependencies; if none is clean, hand-rolling the two required chart types is roughly a day. Tracked as Q-E1.]`

---

## 5. Test strategy

Uneven on purpose. Effort concentrates where trust concentrates.

### 5.1 Property tests on the resolver — the highest-value tests in the suite

Over generated repositories:

1. **Rendered tier never exceeds declared tier.**
2. **Rendered tier never exceeds supported tier.**
3. **Monotonicity: adding an artifact to a repository never lowers any rendered tier.**

Property 3 is the subtle one and it earns its place. It catches a whole class of validation bugs where a newly added file trips a schema check and silently degrades *unrelated* claims — a failure that example-based tests essentially never find, and that would erode author trust faster than any visible bug.

### 5.2 Fixture repositories

| Fixture | Purpose |
|---|---|
| **Honest complete** | Everything declared is supported. Nothing warns. |
| **Honest incomplete** | Declarations ahead of artifacts — the optimistic author, and the common case. Renders down, warns, does not fail. |
| **Adversarial** | Attempts every known gaming vector. Each test asserts the vector is either caught **or** explicitly listed as unenforced in §9 of the standard. |
| **Hostile input** | Malformed YAML, cyclic references, enormous files, path traversal in config. |

**The adversarial fixture doubles as documentation.** When a reviewer asks "can't someone just fake this?", the answer is a file they can read, and every vector in it is either mechanically defeated or honestly declared undefended. This is also the artifact that makes §1 Section D of the validation plan productive — reviewers attack a concrete thing rather than a claim.

### 5.3 The leak test

CI greps the **built bundle** — not the source — against a denylist the author maintains in local config. The denylist file is gitignored, since a committed list of things you cannot say is itself a disclosure.

Crude, and the highest-value test in the suite by consequence. The failure it prevents is not a bug report; it is a broken client relationship and the end of the portfolio's usefulness. Running against the built bundle rather than source is deliberate — the worrying failure mode is content leaking through *transformation*, such as into an alt attribute or a chart label, not content sitting in a file that was correctly marked private.

### 5.4 Remaining tests

Snapshot tests on rendering, regenerated freely. One end-to-end test building a real reference repository and asserting on the diagnostics report. A determinism test per §4.

---

## 6. Budgets

| Property | Budget | Rationale |
|---|---|---|
| Build time | <30s for 50 artifacts | KR 3.1 allows 30 minutes for the whole first run; the build must not be a meaningful fraction |
| Bundle size | <2MB excluding archived artifacts | |
| Largest contentful paint | <2s on throttled mobile | Reviewers read on phones; a portfolio slow on a train is a portfolio that goes unread |

---

## 7. Observability

**Build diagnostics only. No telemetry of any kind.**

This is what makes KR 4.2 — no personal data processed by any component — structurally true rather than a policy claim. There is nowhere for data to go because there is no server and no analytics.

An author may add analytics to their own published site. That is their decision, and it is the only place E4 evidence could ever originate in this project. The standard should state that this is permitted.

---

## 8. Traceability

Blast radius per requirement, so a change to the PRD becomes a scoped conversation rather than a rebuild.

| Requirement | Components | Cost to change |
|---|---|---|
| FR-1 signal detection | validate | Low — additive, new signals are new schema entries |
| FR-2 tier enforcement | resolve, validate | **High** — this is the invariant; property tests are the gate |
| FR-3 visibility levels | filter, emit | Medium — adding a level is easy; changing *when* filtering happens is not (ADR-003) |
| FR-4 eval rendering | render | Low |
| FR-5 front door | render | Low |
| FR-6 single source of truth | ingest, whole architecture | **Very high** — reversing means writable state and a different system |
| FR-7 placeholder visibility | validate, render | Low |

### 8.1 What would void this specification

Three changes would make this document wrong rather than merely outdated:

**Authoring moves into the tool.** FR-6 dies, writable state enters, and this is a different system. Nobody should propose this casually in week seven.

**Collaboration ships.** The data model assumes one repository, one author, one owner. Multi-author attribution needs an author dimension touching the schema, the resolver, and the output format. This is the only hypothesis in the PRD that forces a **rewrite rather than an extension**, and it should be understood as such before anyone treats collaboration as a small addition.

**Any requirement to verify content rather than structure.** Not something a static analyser can do. It would need a fundamentally different trust model, likely signed attestations or third-party verification. If that requirement appears, this document should be closed rather than amended.

---

## 9. Deliberately not engineered

No plugin system. No theming beyond a config file. No incremental builds — full builds are already inside budget. No i18n. No CMS or admin surface, which follows from FR-6. No database. No auth. No caching layer.

Each is somewhere a competent engineer with time would add something reasonable, and where adding it would consume the ten weeks.

**The build should feel underbuilt to anyone reviewing it.** That is preferable to a well-engineered system with nothing good rendered in it — which is the specific way this project fails, per PRD §10.

---

## 10. Open engineering questions

| ID | Question | Resolve by |
|---|---|---|
| Q-E1 | Does purity survive chart rendering? (§4) | Week 5 |
| Q-E2 | Unlisted slug stability across machines — local config vs. content-derived. Leaning local config with explicit export. | Week 6 |
| Q-E3 | Licence governing archived artifacts (§3.5) | Week 9 |
| Q-E4 | Should diagnostics be publishable? Strong integrity signal, strong adoption disincentive. Currently private; held loosely. | Week 8 |
| Q-E5 | Schema versioning — do v0.x repositories still build after v1.0? | Before 1.0.0 |

Q-E4 and Q-E5 are standard questions surfacing as engineering ones, and per §0.1 they resolve in the standard first.
