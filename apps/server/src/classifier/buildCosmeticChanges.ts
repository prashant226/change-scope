/**
 * Converts cosmetic (visual/metadata) raw changes directly into AnalyzedChange
 * records — no AI call. A CSS-only change isn't ambiguous: the diff engine
 * already knows it's cosmetic, so spending an AI call on "is blue→green
 * meaningful?" would be wasted tokens for a question with an obvious answer
 * (§9-10). Each cosmetic change becomes its own group (not merged with
 * content changes, even from the same section — see classifier/partition.ts).
 */
import type { AnalyzedChange, RawChange } from "../types/change.js";
import { fingerprint } from "../snapshot/fingerprint.js";

export function buildCosmeticChanges(cosmetic: RawChange[]): AnalyzedChange[] {
  return cosmetic.map((c) => ({
    groupKey: fingerprint("cosmetic", c.id),
    groupTitle: c.elementLabel || c.section || "Styling",
    section: c.section,
    elementLabel: c.elementLabel,
    changeType: c.changeType,
    classification: c.classification,
    beforeValue: c.beforeValue,
    afterValue: c.afterValue,
    meaningful: false,
    significance: "low",
    whatChanged: `${c.elementLabel || "An element"}'s appearance changed.`,
    whyItMatters: "Classification: CSS/formatting change. No substantive content or functional information appears to have changed.",
    confidence: 1,
    needsReview: false,
    evidence: c.evidence,
  }));
}
