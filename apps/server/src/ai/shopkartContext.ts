/**
 * Deterministic retrieval + contextual grouping for the ShopKart knowledge
 * base (spec Part B §37, §33). No vector DB, no embeddings — plain keyword
 * matching against each group's own section/label/value text, same spirit
 * as the rest of the deterministic pipeline. Only ever runs for a page
 * identified as the ShopKart demo target; every other monitor is completely
 * unaffected.
 */
import type { ChangeGroup } from "../types/change.js";
import { SHOPKART_KB, type KbAppliesTo } from "./shopkartKb.js";

/** Cheap, honest detection — this is a fictional single-monitor demo KB, not a general product catalog. */
export function isShopkartPage(pageUrlOrTitle: string): boolean {
  return /shopkart/i.test(pageUrlOrTitle);
}

function groupText(g: ChangeGroup): string {
  return [g.section, g.groupTitle, ...g.changes.flatMap((c) => [c.elementLabel, c.beforeValue, c.afterValue])]
    .filter((v): v is string => Boolean(v))
    .join(" ")
    .toLowerCase();
}

const MONTH = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";

/** Order matters: a group can match more than one pattern, but topics are collected, not short-circuited. */
const TOPIC_PATTERNS: Array<{ topic: KbAppliesTo; test: RegExp }> = [
  { topic: "availability", test: /\bin stock\b|\bout of stock\b|\bnotify me\b|\bbuy now\b|\badd to cart\b|\bavailab/i },
  { topic: "pricing", test: /₹|\brs\.?\s?\d|\bmrp\b|\bprice\b/i },
  { topic: "discount", test: /%\s?off|\bdiscount\b/i },
  { topic: "promotion", test: new RegExp(`\\bcampaign\\b|\\bsale\\b|\\bdays\\b|\\d{1,2}\\s*[–-]\\s*\\d{1,2}\\s*(${MONTH})`, "i") },
  { topic: "specification", test: /\bcharging\b|\bmah\b|\bghz\b|\bram\b|\bstorage\b|\bcamera\b|\bmp\b|\bhz\b/i },
];

function classifyTopics(g: ChangeGroup): Set<KbAppliesTo> {
  const text = groupText(g);
  const topics = new Set<KbAppliesTo>();
  for (const { topic, test } of TOPIC_PATTERNS) {
    if (test.test(text)) topics.add(topic);
  }
  // Weak fallback: long prose with no digits and nothing else matched reads as descriptive copy, not a spec/price/date.
  if (topics.size === 0 && text.length > 40 && !/\d/.test(text)) {
    topics.add("description");
  }
  return topics;
}

export interface ShopkartContextForGroup {
  guidance: string[];
  constraints: string[];
}

/**
 * Looks up only the KB entries relevant to each group's own topic(s) —
 * never the whole KB — and returns a map keyed by groupKey. Empty (no KB
 * entries at all) unless the page is the ShopKart demo target.
 */
export function retrieveShopkartContext(groups: ChangeGroup[], isShopkart: boolean): Map<string, ShopkartContextForGroup> {
  const result = new Map<string, ShopkartContextForGroup>();
  if (!isShopkart) return result;

  for (const g of groups) {
    const topics = classifyTopics(g);
    if (topics.size === 0) continue;
    const entries = SHOPKART_KB.entries.filter((e) => e.appliesTo.some((a) => topics.has(a)));
    if (entries.length === 0) continue;
    const guidance = [...new Set(entries.flatMap((e) => e.guidance))].slice(0, 4);
    const constraints = [...new Set(entries.flatMap((e) => e.constraints))].slice(0, 4);
    result.set(g.groupKey, { guidance, constraints });
  }
  return result;
}

const MERGE_TITLES: Record<string, string> = {
  availability: "Product availability changed",
  pricing: "Pricing proposition changed",
  promotion: "Promotional campaign updated",
};

function primaryBucket(topics: Set<KbAppliesTo>): string | null {
  if (topics.has("availability")) return "availability";
  if (topics.has("pricing") || topics.has("discount")) return "pricing";
  if (topics.has("promotion")) return "promotion";
  if (topics.has("specification")) return "specification";
  if (topics.has("description")) return "description";
  return null;
}

function mergeGroups(list: ChangeGroup[], title: string): ChangeGroup {
  return {
    groupKey: list.map((g) => g.groupKey).join("+"),
    groupTitle: title,
    section: list[0].section,
    changes: list.flatMap((g) => g.changes),
  };
}

/**
 * ShopKart-only contextual grouping (spec §33): merges groups that describe
 * one related real-world event but landed in different DOM sections —
 * availability+CTA, price+discount, campaign copy+dates, and (only when
 * both are present) specification+description. This never runs for any
 * other monitor, and never merges groups the generic engine already put
 * together — it only combines what the generic engine kept separate.
 */
export function mergeShopkartRelatedGroups(groups: ChangeGroup[], isShopkart: boolean): ChangeGroup[] {
  if (!isShopkart || groups.length < 2) return groups;

  const buckets = new Map<string, ChangeGroup[]>();
  const untouched: ChangeGroup[] = [];

  for (const g of groups) {
    const bucket = primaryBucket(classifyTopics(g));
    if (!bucket) {
      untouched.push(g);
      continue;
    }
    const list = buckets.get(bucket) || [];
    list.push(g);
    buckets.set(bucket, list);
  }

  const merged: ChangeGroup[] = [...untouched];
  for (const bucket of ["availability", "pricing", "promotion"] as const) {
    const list = buckets.get(bucket);
    if (!list) continue;
    merged.push(list.length > 1 ? mergeGroups(list, MERGE_TITLES[bucket]) : list[0]);
  }

  // Specification + description only merge together when both actually occur —
  // a lone spec or description change is not forced into a relationship it doesn't have.
  const specs = buckets.get("specification") || [];
  const descs = buckets.get("description") || [];
  if (specs.length > 0 && descs.length > 0) {
    merged.push(mergeGroups([...specs, ...descs], "Product capability messaging updated"));
  } else {
    merged.push(...specs, ...descs);
  }

  return merged;
}
