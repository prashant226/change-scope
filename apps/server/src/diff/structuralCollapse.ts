/**
 * Change-priority collapsing (QA fix, CartNest V2→V3 §12-13): when a
 * section-level structural event fully explains its element-level
 * consequences, report the higher-level event once instead of every
 * individual consequence. Purely structural (child counts + change types)
 * — no section-name hardcoding, so this applies to any page:
 *
 *   a "Related Articles" section losing all its article cards,
 *   an "Enterprise Plan" section's contents being swapped for a new plan,
 *   CartNest's "Frequently Bought Together" losing all three products —
 *   all the same shape of event, all collapsed the same way.
 *
 * Only collapses when the section's children were WHOLESALE removed or
 * replaced, and nothing else in the section changed (a genuine partial
 * change — one offer among several updated — is never suppressed; see
 * classifyPair's callers, which feed this only whole-section element sets).
 */
import type { RawChange } from "../types/change.js";
import { fingerprint } from "../snapshot/fingerprint.js";

const MIN_CHILDREN_FOR_COLLAPSE = 2;

/**
 * @param sectionChanges Element-level RawChanges already computed for one matched section pair.
 * @param sectionLabel The section's heading (or fallback label).
 * @param afterElementCount How many elements the section has in the CURRENT snapshot (0 = fully emptied).
 */
export function collapseSectionStructuralEvent(
  sectionChanges: RawChange[],
  sectionLabel: string,
  afterElementCount: number,
): RawChange[] {
  const removed = sectionChanges.filter((c) => c.changeType === "removed");
  const added = sectionChanges.filter((c) => c.changeType === "added");
  const other = sectionChanges.filter((c) => c.changeType !== "removed" && c.changeType !== "added");

  // A genuine mix of modifications alongside removals/additions means the
  // section is evolving, not being wiped out or swapped wholesale — leave
  // every change reportable on its own (§4: don't over-suppress).
  if (other.length > 0) return sectionChanges;

  const childLabels = (changes: RawChange[]) => changes.map((c) => c.elementLabel).filter((l): l is string => Boolean(l));

  // Fully emptied: every former child is gone and nothing replaced them.
  if (afterElementCount === 0 && removed.length >= MIN_CHILDREN_FOR_COLLAPSE && added.length === 0) {
    return [
      {
        id: fingerprint("section-emptied", sectionLabel, ...removed.map((c) => c.id)),
        changeType: "removed",
        classification: "structural",
        section: sectionLabel,
        elementLabel: "Section",
        beforeValue: childLabels(removed).join(", "),
        evidence: { collapsedChildRemovals: removed.map((c) => c.id), childCount: removed.length },
      },
    ];
  }

  // Replaced: the old set of children is gone and a comparably-sized new set
  // took their place — report the substitution, not N removes + N adds.
  if (removed.length >= MIN_CHILDREN_FOR_COLLAPSE && added.length >= MIN_CHILDREN_FOR_COLLAPSE) {
    return [
      {
        id: fingerprint("section-replaced", sectionLabel, ...removed.map((c) => c.id), ...added.map((c) => c.id)),
        changeType: "modified",
        classification: "structural",
        section: sectionLabel,
        elementLabel: "Section",
        beforeValue: childLabels(removed).join(", "),
        afterValue: childLabels(added).join(", "),
        evidence: { collapsedChildRemovals: removed.map((c) => c.id), collapsedChildAdditions: added.map((c) => c.id) },
      },
    ];
  }

  return sectionChanges;
}
