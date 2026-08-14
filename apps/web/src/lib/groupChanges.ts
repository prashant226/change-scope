import type { AnalyzedChange } from "../types/api";

/**
 * The backend groups related raw changes under one groupKey (e.g. a price
 * change and its discount both belonging to one "Pricing" event) but returns
 * one AnalyzedChange row per underlying raw change, all sharing that groupKey
 * and the same AI-written explanation. The UI renders one card per group, not
 * per raw change — this collapses the flat list back into groups.
 */
export function groupByKey(changes: AnalyzedChange[]): AnalyzedChange[][] {
  const order: string[] = [];
  const byKey = new Map<string, AnalyzedChange[]>();
  for (const change of changes) {
    if (!byKey.has(change.groupKey)) {
      byKey.set(change.groupKey, []);
      order.push(change.groupKey);
    }
    byKey.get(change.groupKey)!.push(change);
  }
  return order.map((key) => byKey.get(key)!);
}
