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
import { inferSectionTitle, looksLikeGenericLabel } from "./inferSectionTitle.js";
import { factTitleBucket } from "./factType.js";

export function groupChanges(changes: RawChange[], pageTitle?: string): ChangeGroup[] {
  const bySection = new Map<string, RawChange[]>();
  for (const change of changes) {
    const key = change.section || "General";
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(change);
  }

  const groups: ChangeGroup[] = [];
  for (const [section, sectionChanges] of bySection) {
    // A section with no real heading (landmark fallback, or a redesign that
    // consolidated several distinct facts under one wrapper with no
    // sub-headings of its own) has no trustworthy single title. Resolve by
    // fact type instead of guessing one name for the whole section: a
    // section holding only one kind of fact still produces exactly one
    // group (with the same title fact-type resolution would have given it
    // directly), and one holding several kinds — price next to
    // availability next to a spec value — splits into one group per kind
    // instead of mislabeling most of its content as whichever pattern
    // happened to match first.
    if (looksLikeGenericLabel(section, pageTitle)) {
      groups.push(...splitByFactType(section, sectionChanges, pageTitle));
      continue;
    }
    groups.push({
      groupKey: fingerprint("group", section),
      groupTitle: inferSectionTitle(sectionChanges, section, pageTitle),
      section,
      changes: sectionChanges,
    });
  }
  return groups;
}

function splitByFactType(section: string, changes: RawChange[], pageTitle?: string): ChangeGroup[] {
  const byBucket = new Map<string, RawChange[]>();
  for (const change of changes) {
    const bucket = factTitleBucket(change) || "__unclassified__";
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket)!.push(change);
  }

  const groups: ChangeGroup[] = [];
  for (const [bucket, bucketChanges] of byBucket) {
    const title = bucket === "__unclassified__" ? inferSectionTitle(bucketChanges, section, pageTitle) : bucket;
    groups.push({
      groupKey: fingerprint("group", section, bucket),
      groupTitle: title,
      section,
      changes: bucketChanges,
    });
  }
  return groups;
}
