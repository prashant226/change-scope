/**
 * Builds the compact "most important change" one-liners shown in the History
 * timeline (e.g. "Pricing: ₹49,999 → ₹44,999") — up to 2, highest-impact
 * groups first — plus the top significance level, used for the timeline's
 * dot color. The full report already exists elsewhere; this is a preview,
 * not a dump of every change.
 */
import type { AnalyzedChange, Significance } from "../types/change.js";

const RANK: Record<Significance, number> = { high: 2, medium: 1, low: 0 };

export interface ChangePreview {
  lines: string[];
  topSignificance: Significance | null;
}

export function buildChangePreview(meaningfulChanges: AnalyzedChange[], maxItems = 2): ChangePreview {
  const byGroup = new Map<string, AnalyzedChange>();
  for (const c of meaningfulChanges) {
    if (!byGroup.has(c.groupKey)) byGroup.set(c.groupKey, c); // first row of each group is enough for a preview
  }

  const sorted = [...byGroup.values()].sort((a, b) => RANK[b.significance] - RANK[a.significance]);

  return {
    lines: sorted.slice(0, maxItems).map((c) => `${c.groupTitle}: ${c.beforeValue ?? "—"} → ${c.afterValue ?? "—"}`),
    topSignificance: sorted[0]?.significance ?? null,
  };
}
