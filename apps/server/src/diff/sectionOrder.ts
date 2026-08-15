/**
 * Section-reorder detection (QA fix, CartNest V2→V3 §6-11). matchSections
 * already gives sections stable identity by heading (never DOM index), so
 * the SAME logical section surviving a reorder is already recognized as one
 * section, not a remove+add pair — that part was already correct. What was
 * missing: nothing ever compared each section's *relative order* across the
 * two snapshots, so a pure reorder produced no change at all.
 *
 * Reports at most one structural "Section order" event per comparison,
 * describing the full relative order of sections common to both snapshots
 * — not every possible pairwise swap — so a page-wide reshuffle still reads
 * as one logical event instead of N.
 */
import type { PageSnapshot } from "../types/snapshot.js";
import type { RawChange } from "../types/change.js";
import { sectionKey } from "./matchElements.js";
import { fingerprint } from "../snapshot/fingerprint.js";

export function detectSectionReorder(before: PageSnapshot["sections"], after: PageSnapshot["sections"]): RawChange | null {
  // Only sections with a real heading count as stable identity here — a
  // position-fallback key ("section-3") is a DOM-order artifact, not a
  // durable label, and comparing those would flag every layout shift as a
  // "reorder" rather than an actual same-section move.
  const beforeKeys = new Set(before.filter((s) => s.heading).map(sectionKey));
  const afterKeys = new Set(after.filter((s) => s.heading).map(sectionKey));

  const beforeOrder = before.filter((s) => s.heading && afterKeys.has(sectionKey(s))).map((s) => s.heading!.trim());
  const afterOrder = after.filter((s) => s.heading && beforeKeys.has(sectionKey(s))).map((s) => s.heading!.trim());

  if (beforeOrder.length < 2 || afterOrder.length < 2) return null;
  if (beforeOrder.join("␟") === afterOrder.join("␟")) return null;

  return {
    id: fingerprint("section-reorder", beforeOrder.join(","), afterOrder.join(",")),
    changeType: "moved",
    classification: "structural",
    section: "Page Structure",
    elementLabel: "Section order",
    beforeValue: beforeOrder.join(" → "),
    afterValue: afterOrder.join(" → "),
  };
}
