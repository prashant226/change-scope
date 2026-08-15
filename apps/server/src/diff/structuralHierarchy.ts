/**
 * Structural Hierarchy Analysis (root-cause fix, Failure A): sections are
 * stored as a flat, position-ordered list — there was never a parent/child
 * relationship between them. So a page with:
 *
 *   H2 "Recommended Products"
 *     H3 "Product A"
 *     H3 "Product B"
 *     H3 "Product C"
 *
 * produces four *sibling* sections, not one section with three children.
 * When the whole thing is removed, each of those four sections
 * independently reads as its own top-level removal — the child-suppression
 * fix from the V2→V3 QA round (structuralCollapse.ts) only ever handled
 * elements removed *within* one still-matched section; it had no way to
 * see that "Product A" the *section* is logically nested under
 * "Recommended Products" the *section*.
 *
 * This reconstructs that hierarchy from heading levels (headingLevel,
 * captured in extractPage.ts) using the standard "nearest preceding
 * section with a strictly shallower level is the parent" rule — the same
 * approach a table-of-contents builder uses to turn a flat H1-H6 sequence
 * into a tree — then suppresses a removed/added section's event when an
 * ancestor of it was removed/added in the very same comparison. Suppressed
 * events are never discarded — they're kept as evidence on the ancestor
 * event that explains them.
 */
import type { PageSnapshot, SnapshotSection } from "../types/snapshot.js";
import type { RawChange } from "../types/change.js";

function normalizeKey(label: string): string {
  return label.trim().toLowerCase();
}

/** heading-text key -> parent's heading-text key (or null for a top-level/landmark section). */
export function buildParentMap(sections: SnapshotSection[]): Map<string, string | null> {
  const parentOf = new Map<string, string | null>();
  const stack: { key: string; level: number }[] = [];
  const ordered = [...sections].sort((a, b) => a.position - b.position);

  for (const s of ordered) {
    const key = normalizeKey(s.heading || `section-${s.position}`);
    if (s.headingLevel == null) {
      // A landmark-derived or already-generic section has no real level to
      // compare — it never acts as a parent or child in this hierarchy.
      parentOf.set(key, null);
      continue;
    }
    while (stack.length > 0 && stack[stack.length - 1].level >= s.headingLevel) stack.pop();
    parentOf.set(key, stack.length > 0 ? stack[stack.length - 1].key : null);
    stack.push({ key, level: s.headingLevel });
  }
  return parentOf;
}

function findRemovedAncestor(key: string, parentOf: Map<string, string | null>, removedKeys: Set<string>): string | null {
  const seen = new Set<string>();
  let current = parentOf.get(key) ?? null;
  while (current) {
    if (removedKeys.has(current)) return current;
    if (seen.has(current)) return null; // defensive cycle guard
    seen.add(current);
    current = parentOf.get(current) ?? null;
  }
  return null;
}

/**
 * Suppresses a section-level added/removed event when an ancestor section
 * (by heading hierarchy, see buildParentMap) was itself added/removed in
 * the same comparison — that ancestor event already fully explains it.
 * Non-section-level changes (element-level content/functional/etc.) pass
 * through untouched; this only ever looks at changeType "added"/"removed"
 * with elementLabel "Section".
 */
export function suppressDerivedSectionEvents(changes: RawChange[], before: PageSnapshot, after: PageSnapshot): RawChange[] {
  const beforeParentOf = buildParentMap(before.sections);
  const afterParentOf = buildParentMap(after.sections);

  const removed = changes.filter((c) => c.changeType === "removed" && c.elementLabel === "Section");
  const added = changes.filter((c) => c.changeType === "added" && c.elementLabel === "Section");
  const removedKeys = new Set(removed.map((c) => normalizeKey(c.section || c.beforeValue || "")));
  const addedKeys = new Set(added.map((c) => normalizeKey(c.section || c.afterValue || "")));

  // Attach suppressed children to whichever kept event is their nearest
  // surviving ancestor, so the evidence isn't just dropped — it travels
  // with the event that actually explains it.
  const suppressedChildrenByAncestor = new Map<string, string[]>();

  const result: RawChange[] = [];
  for (const change of changes) {
    if (change.changeType === "removed" && change.elementLabel === "Section") {
      const key = normalizeKey(change.section || change.beforeValue || "");
      const ancestorKey = findRemovedAncestor(key, beforeParentOf, removedKeys);
      if (ancestorKey) {
        const list = suppressedChildrenByAncestor.get(ancestorKey) ?? [];
        list.push(change.beforeValue || change.section || "");
        suppressedChildrenByAncestor.set(ancestorKey, list);
        continue; // derived — excluded from top-level results
      }
    }
    if (change.changeType === "added" && change.elementLabel === "Section") {
      const key = normalizeKey(change.section || change.afterValue || "");
      const ancestorKey = findRemovedAncestor(key, afterParentOf, addedKeys);
      if (ancestorKey) {
        const list = suppressedChildrenByAncestor.get(ancestorKey) ?? [];
        list.push(change.afterValue || change.section || "");
        suppressedChildrenByAncestor.set(ancestorKey, list);
        continue;
      }
    }
    result.push(change);
  }

  // Second pass: stamp the surviving ancestor events with what they suppressed.
  return result.map((change) => {
    if (change.changeType !== "removed" && change.changeType !== "added") return change;
    if (change.elementLabel !== "Section") return change;
    const key = normalizeKey(change.section || change.beforeValue || change.afterValue || "");
    const suppressedChildren = suppressedChildrenByAncestor.get(key);
    if (!suppressedChildren) return change;
    return { ...change, evidence: { ...change.evidence, suppressedChildSections: suppressedChildren } };
  });
}
