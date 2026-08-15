/**
 * Semantic fact typing (QA fix, CartNest V6 §14-15): a single deterministic
 * signal for "what kind of fact is this change about?", independent of
 * whatever DOM section it happens to live in. Exists specifically to stop a
 * generic/heterogeneous section (e.g. a redesigned hero with no distinct
 * sub-headings, holding price + availability + CTA + specs all together)
 * from being named and grouped as one thing just because the first-matching
 * pattern in inferSectionTitle.ts happened to be "Pricing" — see group.ts's
 * use of this to split such a section by fact type instead of guessing one
 * title for all of it.
 */
export type FactType =
  | "price"
  | "discount"
  | "availability"
  | "cta"
  | "rating"
  | "review_count"
  | "specification"
  | "delivery"
  | "offer";

interface FactTypeRule {
  type: FactType;
  test: RegExp;
}

// Order matters — checked first-match, most specific/unambiguous signals first.
const RULES: FactTypeRule[] = [
  { type: "review_count", test: /\breviews?\b/i },
  { type: "rating", test: /\brating\b|\/\s?5\b|\bstars?\b|\bout of 5\b/i },
  { type: "discount", test: /%\s?off|\bdiscount\b/i },
  { type: "price", test: /[₹$€£]|\bprice\b|\bmrp\b/i },
  { type: "delivery", test: /\bdelivery\b|\bdispatch\b|\bshipping\b/i },
  { type: "offer", test: /\boffer\b|\bemi\b|\bexchange bonus\b|\bbank card\b|\binstant discount\b/i },
  { type: "availability", test: /\bin stock\b|\bout of stock\b|\bunavailable\b|\bsold out\b|\bavailable\b/i },
  { type: "cta", test: /\bbuy now\b|\badd to cart\b|\bnotify me\b|\bcheckout\b/i },
  { type: "specification", test: /\b\d+\s?(hz|gb|mah|w|mp)\b/i },
];

/** The one text blob a fact-type check runs against — element identity + values, never the (possibly generic/misleading) section label. */
export function factText(change: { elementLabel?: string; beforeValue?: string; afterValue?: string }): string {
  return [change.elementLabel, change.beforeValue, change.afterValue].filter(Boolean).join(" ");
}

export function inferFactType(text: string): FactType | null {
  return RULES.find((r) => r.test.test(text))?.type ?? null;
}

/**
 * The report-facing group title a fact type resolves to. Several fact types
 * share one title on purpose — price+discount are "Pricing" together (§2 of
 * the V1→V2 spec), availability+cta are "Availability" together (§V2→V3),
 * rating+review_count are "Customer Ratings" together — splitting by raw
 * FactType would wrongly break those existing, correct pairings apart.
 */
export const FACT_TYPE_TITLES: Record<FactType, string> = {
  price: "Pricing",
  discount: "Pricing",
  availability: "Availability",
  cta: "Availability",
  rating: "Customer Ratings",
  review_count: "Customer Ratings",
  specification: "Specifications",
  delivery: "Delivery",
  offer: "Available offers",
};

/** The resolved title bucket for a change, or null if no fact type matched (falls back to the existing content-shape heuristic). */
export function factTitleBucket(change: { elementLabel?: string; beforeValue?: string; afterValue?: string }): string | null {
  const type = inferFactType(factText(change));
  return type ? FACT_TYPE_TITLES[type] : null;
}
