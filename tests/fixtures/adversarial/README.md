# Adversarial fixture

Every gaming vector known to this project, in one repository.

**This file doubles as documentation.** When a reviewer asks "can't someone just
fake this?", the answer is a repository they can read rather than a claim they
have to trust. It is also the artifact to hand a practitioner during the
adversarial section of a review interview — attacking a concrete thing produces
far better findings than "do you think this could be gamed?".

Every vector below is in one of two states, and there is no third:

- **CAUGHT** — a mechanical check defeats it. There is a test asserting so.
- **UNENFORCED** — the standard cannot check it, and says so publicly in
  `spec/standard-v0.1.md` §9. There is a test asserting the vector is listed
  there, so a vector can never quietly move from declared-undefendable to
  forgotten.

A vector in neither state is a bug in this fixture.

---

## Vectors

| # | Vector | File | Status | Defeated by |
|---|---|---|---|---|
| V1 | Declare E5 with no supporting artifacts at all | `docs/product/results/2026-09-14-overclaim.md` | **CAUGHT** | Capping rule. Renders E1. |
| V2 | Edit the golden set after the baseline so the number improves | `docs/product/results/2026-09-14-tampered.md` | **CAUGHT** | Hash pinning (D4). Caps at E2, error diagnostic. |
| V3 | Backdate a decision to appear pre-hoc | `docs/product/decisions/0002-backdated.md` | **CAUGHT** | Unanchored retrospective caps at E0. |
| V4 | Hide a failed result by marking it private | `docs/product/results/2026-08-01-buried.md` | **UNENFORCED** | Not detectable. An author may publish a subset. |
| V5 | Invent an interview that never happened | `docs/product/discovery/synthesis.md` | **UNENFORCED** | §9 row 6. Deterred by requiring method, segment, recruitment. |
| V6 | Type a number that did not come from the run | `docs/product/results/2026-09-14-typed.md` | **UNENFORCED** | §9 row 8. Incentive design only. |
| V7 | Build a golden set of trivially easy cases | `evals/golden/v1.jsonl` | **UNENFORCED** | §9 row 7. Representativeness is not decidable from the file. |
| V8 | Claim a tier via malformed front matter to skip validation | `docs/product/malformed.md` | **CAUGHT** | Unparseable declaration floors to E0. |
| V9 | Escape the repository root via config path traversal | `preview.config.json` | **CAUGHT** | Containment check at ingest. |
| V10 | Leak private content by mislabelling visibility | `docs/product/typo-visibility.md` | **CAUGHT** | Unrecognised visibility floors to `private`. |

---

## The honest reading

Four of ten vectors are unenforced, and three of those four are the ones a
determined fabricator would actually reach for. That ratio is not a defect being
hidden — it is the reason `spec/standard-v0.1.md` §9 exists and is required to
appear in rendered output.

The standard's claim is narrow and should be read narrowly: **a tier means
artifacts of the required shape exist and are internally consistent.** It has
never claimed the artifacts are honest, and any presentation implying otherwise
would be committing the fault the project exists to prevent.

What the mechanical checks do is remove the *cheap* attacks. V1, V2, V3, V8, V9
and V10 are all things someone might try casually or by accident. What remains
requires deliberate, sustained fabrication — which is a different act, carries
real risk when a reviewer follows a link, and is exactly the behaviour the
"publishable failure" principle is designed to make pointless.
