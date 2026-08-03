/**
 * Tier — the evidence ladder, as a total order.
 *
 * This file is the foundation of the invariant in spec/standard-v0.1.md §7:
 *
 *   > A claim renders at a tier no higher than the artifacts in the
 *   > repository can support.
 *
 * It is four lines of real logic and it is the most security-relevant code in
 * the project. Everything else is markdown to HTML. A bug here is a false
 * statement made to someone making a hiring decision.
 *
 * Tested exhaustively over all 36 ordered pairs rather than by spot check.
 */

/** The evidence ladder. Ordered E0 < E1 < E2 < E3 < E4 < E5. */
export const TIERS = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5'] as const;

export type Tier = (typeof TIERS)[number];

/**
 * Rank of a tier in the total order. Lower is weaker.
 * Not exported: callers compare tiers through `minTier` / `isAtLeast`, never
 * by arithmetic on raw ranks.
 */
const RANK: Readonly<Record<Tier, number>> = Object.freeze({
  E0: 0,
  E1: 1,
  E2: 2,
  E3: 3,
  E4: 4,
  E5: 5,
});

/** Type guard. Any value not on the ladder is not a tier. */
export function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value);
}

/**
 * Parse an untrusted tier declaration from front matter.
 *
 * Returns E0 — never null, never the input — when the value is absent,
 * malformed, or not on the ladder. Failing to the floor rather than throwing
 * keeps a single malformed document from failing an entire build, per
 * spec/build-v1.md §3.3, while guaranteeing an unparseable declaration can
 * never grant a tier.
 */
export function parseTier(value: unknown): Tier {
  return isTier(value) ? value : 'E0';
}

/**
 * The capping rule of spec/standard-v0.1.md §7.
 *
 * `rendered = min(declared, supported)`
 *
 * There is no code path by which this returns a tier above either argument.
 * That property is asserted in tests/property/resolver.test.ts.
 */
export function minTier(a: Tier, b: Tier): Tier {
  return RANK[a] <= RANK[b] ? a : b;
}

/** True when `tier` is at or above `floor` in the total order. */
export function isAtLeast(tier: Tier, floor: Tier): boolean {
  return RANK[tier] >= RANK[floor];
}

/** True when a declaration exceeds what the repository supports. */
export function isOverclaim(declared: Tier, supported: Tier): boolean {
  return RANK[declared] > RANK[supported];
}
