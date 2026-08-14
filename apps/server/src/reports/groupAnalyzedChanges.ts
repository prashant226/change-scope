/**
 * Mirrors apps/web/src/lib/groupChanges.ts: the AI enriches changes at the
 * group level but the API returns one AnalyzedChange row per underlying raw
 * change, all sharing a groupKey. Anything rendering a report (this file,
 * the PDF renderer) needs to collapse them back into groups first, or a
 * multi-change event (e.g. price + its discount) renders as duplicate cards.
 */
import type { AnalyzedChange } from "../types/change.js";

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
