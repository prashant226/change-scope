/**
 * Groups related raw changes into higher-level events (§51). Kept deterministic
 * and simple: changes within the same section are grouped together so, e.g.,
 * "In Stock → Out of Stock" + "Buy Now → Notify Me" surface as one
 * "Availability" event instead of two disconnected diffs. AI may further
 * refine grouping titles/semantics, but never invents the underlying facts.
 *
 * Callers must pass only AI-candidate changes (see classifier/partition.ts) —
 * cosmetic (visual/metadata) changes are handled separately and must never
 * end up merged into the same group as a content/functional change.
 */
import type { ChangeGroup, RawChange } from "../types/change.js";
import { fingerprint } from "../snapshot/fingerprint.js";
import { inferSectionTitle } from "./inferSectionTitle.js";

export function groupChanges(changes: RawChange[], pageTitle?: string): ChangeGroup[] {
  const bySection = new Map<string, RawChange[]>();
  for (const change of changes) {
    const key = change.section || "General";
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(change);
  }

  const groups: ChangeGroup[] = [];
  for (const [section, sectionChanges] of bySection) {
    groups.push({
      groupKey: fingerprint("group", section),
      groupTitle: inferSectionTitle(sectionChanges, section, pageTitle),
      section,
      changes: sectionChanges,
    });
  }
  return groups;
}
