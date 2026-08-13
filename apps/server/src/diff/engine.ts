/**
 * Deterministic diff engine (§48). Compares two full snapshots and returns raw
 * change facts. No AI involved — see classifier/classify.ts for the rule-based
 * category assignment applied to each matched pair.
 */
import type { PageSnapshot } from "../types/snapshot.js";
import type { RawChange } from "../types/change.js";
import { matchSections, matchElements } from "./matchElements.js";
import { classifyPair } from "../classifier/classify.js";
import { fingerprint } from "../snapshot/fingerprint.js";

export function diffSnapshots(before: PageSnapshot, after: PageSnapshot): RawChange[] {
  const changes: RawChange[] = [];
  const sectionPairs = matchSections(before.sections, after.sections);

  for (const pair of sectionPairs) {
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
    for (const ep of elementPairs) {
      const change = classifyPair(ep, sectionLabel);
      if (change) changes.push(change);
    }
  }

  return changes;
}
