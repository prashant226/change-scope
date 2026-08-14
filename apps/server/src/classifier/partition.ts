/**
 * Splits raw changes into AI-reasoning candidates vs. deterministic cosmetic
 * noise, BEFORE grouping. A CSS-only change is not ambiguous — the diff
 * engine already knows it's cosmetic — so it never needs an AI call, and
 * critically it must never share a group with a genuine content/functional
 * change just because they happened to live in the same page section
 * (otherwise one AI verdict would incorrectly cover both).
 */
import type { RawChange } from "../types/change.js";

const COSMETIC_CLASSIFICATIONS = new Set(["visual", "metadata"]);

export interface PartitionedChanges {
  candidates: RawChange[];
  cosmetic: RawChange[];
}

export function partitionChanges(changes: RawChange[]): PartitionedChanges {
  const candidates: RawChange[] = [];
  const cosmetic: RawChange[] = [];
  for (const change of changes) {
    if (COSMETIC_CLASSIFICATIONS.has(change.classification)) {
      cosmetic.push(change);
    } else {
      candidates.push(change);
    }
  }
  return { candidates, cosmetic };
}
