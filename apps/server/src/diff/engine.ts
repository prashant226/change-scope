/**
 * Deterministic diff engine (§48). Compares two full snapshots and returns raw
 * change facts. No AI involved — see classifier/classify.ts for the rule-based
 * category assignment applied to each matched pair.
 */
import type { PageSnapshot } from "../types/snapshot.js";
import type { RawChange } from "../types/change.js";
import { matchSections, matchElements } from "./matchElements.js";
import { classifyPair } from "../classifier/classify.js";
import { collapseSectionStructuralEvent } from "./structuralCollapse.js";
import { detectSectionReorder } from "./sectionOrder.js";
import { resolveSemanticContinuity, buildContinuityEvent } from "./semanticContinuity.js";
import { fingerprint } from "../snapshot/fingerprint.js";

export function diffSnapshots(before: PageSnapshot, after: PageSnapshot): RawChange[] {
  const changes: RawChange[] = [];
  const sectionPairs = matchSections(before.sections, after.sections);

  // Semantic Identity Resolution: before treating an unmatched section as a
  // plain removal/addition, check whether it's actually the same logical
  // section as some other unmatched section that moved/was renamed (see
  // semanticContinuity.ts). Matched sections are excluded from the normal
  // add/remove branches below and handled once, together, afterward.
  const beforeOnlySections = sectionPairs.filter((p) => p.before && !p.after).map((p) => p.before!);
  const afterOnlySections = sectionPairs.filter((p) => p.after && !p.before).map((p) => p.after!);
  const continuityMatches = resolveSemanticContinuity(beforeOnlySections, afterOnlySections);
  const continuityBeforeIds = new Set(continuityMatches.map((m) => m.before.id));
  const continuityAfterIds = new Set(continuityMatches.map((m) => m.after.id));

  for (const pair of sectionPairs) {
    if (pair.before && !pair.after && continuityBeforeIds.has(pair.before.id)) continue;
    if (pair.after && !pair.before && continuityAfterIds.has(pair.after.id)) continue;

    const sectionLabel = pair.after?.heading || pair.before?.heading || "General";

    if (!pair.before && pair.after) {
      changes.push({
        id: fingerprint("section-added", pair.key),
        changeType: "added",
        classification: "structural",
        section: sectionLabel,
        elementLabel: "Section",
        afterValue: sectionLabel,
      });
      continue;
    }
    if (pair.before && !pair.after) {
      changes.push({
        id: fingerprint("section-removed", pair.key),
        changeType: "removed",
        classification: "structural",
        section: sectionLabel,
        elementLabel: "Section",
        beforeValue: sectionLabel,
      });
      continue;
    }
    if (!pair.before || !pair.after) continue;

    const elementPairs = matchElements(pair.before.elements, pair.after.elements);
    const sectionChanges: RawChange[] = [];
    for (const ep of elementPairs) {
      const change = classifyPair(ep, sectionLabel);
      if (change) sectionChanges.push(change);
    }
    // A section whose heading survived but whose children were wholesale
    // removed or replaced is a section-level structural event, not N
    // independent element removals — see structuralCollapse.ts.
    changes.push(...collapseSectionStructuralEvent(sectionChanges, sectionLabel, pair.after.elements.length));
  }

  // Sections found to be the same logical content that moved/was renamed:
  // one structural "moved" event for the move itself, plus real element-
  // level changes inside it (if any) compared directly against its actual
  // current counterpart — not stale, not a different section entirely.
  for (const match of continuityMatches) {
    changes.push(buildContinuityEvent(match));

    const sectionLabel = match.after.heading || match.before.heading || "General";
    const elementPairs = matchElements(match.before.elements, match.after.elements);
    const sectionChanges: RawChange[] = [];
    for (const ep of elementPairs) {
      const change = classifyPair(ep, sectionLabel);
      if (change) sectionChanges.push(change);
    }
    changes.push(...collapseSectionStructuralEvent(sectionChanges, sectionLabel, match.after.elements.length));
  }

  const reorder = detectSectionReorder(before.sections, after.sections);
  if (reorder) changes.push(reorder);

  return changes;
}
