/**
 * Semantic fact extraction + duplicate-fact consolidation (QA fix, CartNest
 * V1→V2). Runs on AI-candidate changes only (never cosmetic ones — see
 * partition.ts), between partitioning and grouping:
 *
 *   partition → [extractSemanticFacts] → group → AI reasoning
 *
 * Two problems this solves, both entirely generic (no CartNest/ShopKart
 * hardcoding, per the "must keep supporting arbitrary webpages" rule):
 *
 * 1. The same underlying fact sometimes shows up as more than one DOM
 *    change (e.g. a review count repeated in a product title area AND a
 *    "Based on N reviews" summary elsewhere) — these must collapse into
 *    ONE logical change before the report is built, not be reported twice.
 * 2. A single element sometimes expresses two unrelated facts at once
 *    (e.g. "4.4 / 5 from 2,436 reviews" is both a rating AND a review
 *    count) — these must be split into separate facts so each can be
 *    judged/grouped/named on its own terms.
 *
 * Deterministic and cheap on purpose (§17): this is exactly the kind of
 * "obvious duplicate candidate" work that doesn't need an AI call — it's
 * plain number/keyword extraction, the same spirit as classify.ts.
 */
import type { RawChange } from "../types/change.js";
import { fingerprint } from "../snapshot/fingerprint.js";
import { looksLikeGenericLabel } from "./inferSectionTitle.js";

interface FactDomain {
  name: string;
  test: RegExp;
}

// Order matters where patterns could otherwise overlap (checked first-match).
const DOMAINS: FactDomain[] = [
  { name: "review_count", test: /\breviews?\b/i },
  { name: "discount", test: /%\s?off|\bdiscount\b/i },
  { name: "price", test: /[₹$€£]|\bprice\b|\bmrp\b/i },
  { name: "rating", test: /\brating\b|\/\s?5\b|\bstars?\b|\bout of 5\b/i },
  { name: "availability", test: /\bin stock\b|\bout of stock\b|\bavailable\b|\bunavailable\b|\bsold out\b/i },
];

const FACT_CLASSIFICATIONS = new Set(["content", "functional"]);

function extractNumber(text?: string): number | null {
  if (!text) return null;
  const match = text.match(/\d[\d,]*(?:\.\d+)?/);
  if (!match) return null;
  const n = parseFloat(match[0].replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

interface FactSignature {
  domain: string;
  beforeKey: string;
  afterKey: string;
}

function extractFactSignature(change: RawChange): FactSignature | null {
  if (!FACT_CLASSIFICATIONS.has(change.classification)) return null;
  const text = [change.section, change.elementLabel, change.beforeValue, change.afterValue].filter(Boolean).join(" ");
  const domain = DOMAINS.find((d) => d.test.test(text))?.name;
  if (!domain) return null;

  if (domain === "availability") {
    const before = (change.beforeValue || "").trim().toLowerCase();
    const after = (change.afterValue || "").trim().toLowerCase();
    if (!before || !after) return null;
    return { domain, beforeKey: before, afterKey: after };
  }

  const beforeNum = extractNumber(change.beforeValue);
  const afterNum = extractNumber(change.afterValue);
  if (beforeNum === null || afterNum === null) return null;
  return { domain, beforeKey: String(beforeNum), afterKey: String(afterNum) };
}

function textLen(c: RawChange): number {
  return (c.beforeValue?.length || 0) + (c.afterValue?.length || 0);
}

/**
 * Picks the representative for a consolidated fact: the cleanest (shortest)
 * before/after text, but a section that isn't just the page's own title —
 * a title-as-section is a fallback-of-last-resort elsewhere in the
 * pipeline (reuses the same generic-label check as inferSectionTitle.ts, so
 * a page's <title> including a spec/detail suffix beyond the H1 text is
 * still correctly recognized as page identity, not a real content section).
 */
function mergeFactGroup(group: RawChange[], pageTitle: string): RawChange {
  const preferredSection = group.find((c) => !looksLikeGenericLabel(c.section || "", pageTitle)) ?? group[0];
  const cleanest = [...group].sort((a, b) => textLen(a) - textLen(b))[0];
  return {
    ...cleanest,
    id: fingerprint("fact", ...group.map((g) => g.id)),
    section: preferredSection.section,
    evidence: { ...cleanest.evidence, consolidatedFrom: group.map((g) => g.id), duplicateFactCount: group.length },
  };
}

/** Collapses changes that express the same underlying fact into one. */
export function consolidateDuplicateFacts(changes: RawChange[], pageTitle: string): RawChange[] {
  const groups = new Map<string, RawChange[]>();
  const passthrough: RawChange[] = [];

  for (const change of changes) {
    const sig = extractFactSignature(change);
    if (!sig) {
      passthrough.push(change);
      continue;
    }
    const key = `${sig.domain}::${sig.beforeKey}::${sig.afterKey}`;
    const list = groups.get(key);
    if (list) list.push(change);
    else groups.set(key, [change]);
  }

  const result = [...passthrough];
  for (const group of groups.values()) {
    result.push(group.length === 1 ? group[0] : mergeFactGroup(group, pageTitle));
  }
  return result;
}

// "4.4 / 5 from 2,436 reviews" — a generic rating-summary pattern seen across
// many e-commerce/review UIs, not specific to any one site.
const COMPOUND_RATING_REVIEW = /(\d+(?:\.\d+)?)\s*\/\s*5\D{0,20}?([\d,]+)\s*reviews?/i;

/** Splits one element that expresses two unrelated facts (rating + review count) into two. */
export function decomposeCompoundFacts(changes: RawChange[]): RawChange[] {
  return changes.flatMap((change): RawChange[] => {
    if (change.classification !== "content" || !change.beforeValue || !change.afterValue) return [change];
    const before = change.beforeValue.match(COMPOUND_RATING_REVIEW);
    const after = change.afterValue.match(COMPOUND_RATING_REVIEW);
    if (!before || !after) return [change];

    const parts: RawChange[] = [];
    if (before[1] !== after[1]) {
      parts.push({ ...change, id: fingerprint("fact-rating", change.id), elementLabel: "Rating", beforeValue: before[1], afterValue: after[1] });
    }
    if (before[2] !== after[2]) {
      parts.push({ ...change, id: fingerprint("fact-reviews", change.id), elementLabel: "Review count", beforeValue: before[2], afterValue: after[2] });
    }
    // Both sub-facts happened to be identical (shouldn't normally reach here
    // since the combined text did change) — fall back to the original rather
    // than silently dropping a real change.
    return parts.length > 0 ? parts : [change];
  });
}

/** Decompose, then consolidate — the full semantic-fact step between partitioning and grouping. */
export function extractSemanticFacts(changes: RawChange[], pageTitle: string): RawChange[] {
  return consolidateDuplicateFacts(decomposeCompoundFacts(changes), pageTitle);
}
