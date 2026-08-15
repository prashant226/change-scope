/**
 * Semantic Identity Resolution (QA fix, CartNest V6): the new step the spec
 * calls for between element matching and change classification.
 *
 * matchSections (matchElements.ts) already gives a section stable identity
 * by heading text — but that's exactly what breaks when a redesign renames
 * a heading ("Key Highlights" → "Key Benefits") or reparents content under
 * a new heading ("Product Description" → "Product Details"). Neither key
 * matches, so the old section reads as removed and the new one as added,
 * even though the underlying content barely changed.
 *
 * This module looks for evidence that an unmatched before-section and an
 * unmatched after-section are actually the SAME logical section that moved
 * — measured by how much of their element content persists, using each
 * element's fingerprint (an identity signal that depends on tag/role/href/
 * src/text, never on which section it lives in — see snapshot/build.ts) —
 * never by comparing heading text, which is exactly what's unreliable here.
 */
import type { SnapshotSection } from "../types/snapshot.js";
import type { RawChange } from "../types/change.js";
import { fingerprint } from "../snapshot/fingerprint.js";

export interface ContinuityMatch {
  before: SnapshotSection;
  after: SnapshotSection;
  overlapRatio: number;
}

// At least this fraction of the smaller section's content must persist for
// two differently-headed sections to be treated as the same one that moved,
// rather than a genuine removal + unrelated addition (§19 — don't over-suppress
// a real replacement just because a few incidental elements coincide).
const CONTINUITY_THRESHOLD = 0.4;

function fingerprintSet(s: SnapshotSection): Set<string> {
  return new Set(s.elements.map((e) => e.fingerprint));
}

/**
 * @param beforeOnly Sections present only in the previous snapshot (no same-key match in the current one).
 * @param afterOnly Sections present only in the current snapshot.
 */
export function resolveSemanticContinuity(beforeOnly: SnapshotSection[], afterOnly: SnapshotSection[]): ContinuityMatch[] {
  const candidates: ContinuityMatch[] = [];
  for (const before of beforeOnly) {
    const beforeSet = fingerprintSet(before);
    if (beforeSet.size === 0) continue; // an empty section carries no content signal to match on
    for (const after of afterOnly) {
      const afterSet = fingerprintSet(after);
      if (afterSet.size === 0) continue;
      let shared = 0;
      for (const fp of beforeSet) if (afterSet.has(fp)) shared++;
      const overlapRatio = shared / Math.min(beforeSet.size, afterSet.size);
      if (overlapRatio >= CONTINUITY_THRESHOLD) candidates.push({ before, after, overlapRatio });
    }
  }

  // Greedy best-match-first assignment — each section can anchor at most one
  // continuity pairing, so a strong match doesn't get displaced by a weaker
  // one processed later, and no section is claimed twice.
  candidates.sort((a, b) => b.overlapRatio - a.overlapRatio);
  const usedBefore = new Set<string>();
  const usedAfter = new Set<string>();
  const matches: ContinuityMatch[] = [];
  for (const c of candidates) {
    if (usedBefore.has(c.before.id) || usedAfter.has(c.after.id)) continue;
    usedBefore.add(c.before.id);
    usedAfter.add(c.after.id);
    matches.push(c);
  }
  return matches;
}

/**
 * The one structural event describing a continuity match itself — that the
 * section moved/was renamed — separate from whatever real fact-level
 * changes (if any) are found inside it by the normal element-matching pass.
 */
export function buildContinuityEvent(match: ContinuityMatch): RawChange {
  const beforeLabel = match.before.heading || "Untitled section";
  const afterLabel = match.after.heading || "Untitled section";
  return {
    id: fingerprint("section-continuity", match.before.id, match.after.id),
    changeType: "moved",
    classification: "structural",
    section: afterLabel,
    elementLabel: "Section",
    beforeValue: beforeLabel,
    afterValue: afterLabel,
    evidence: { overlapRatio: match.overlapRatio, reason: "semantic-continuity" },
  };
}
