/**
 * Counts logical change EVENTS (unique groupKeys), not raw AnalyzedChange
 * rows. A "Pricing" group with two underlying rows (price + discount) is one
 * meaningful change, not two — the top-of-report summary and run counters
 * must reflect that, never DOM/diff-row counts.
 */
import type { AnalyzedChange } from "../types/change.js";

export function countGroups(changes: AnalyzedChange[]): { meaningful: number; cosmetic: number } {
  const meaningfulKeys = new Set(changes.filter((c) => c.meaningful).map((c) => c.groupKey));
  const cosmeticKeys = new Set(changes.filter((c) => !c.meaningful).map((c) => c.groupKey));
  return { meaningful: meaningfulKeys.size, cosmetic: cosmeticKeys.size };
}
