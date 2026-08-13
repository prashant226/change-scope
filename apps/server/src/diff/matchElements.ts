/**
 * Stable element matching across two snapshots (§47). Uses multiple signals —
 * section identity, tag/role, href, and position — rather than raw DOM index,
 * so "price element changed value" is recognized as one modified element
 * instead of a remove+add pair.
 */
import type { SnapshotElement, SnapshotSection } from "../types/snapshot.js";

export interface SectionPair {
  before?: SnapshotSection;
  after?: SnapshotSection;
  key: string;
}

export interface ElementPair {
  before?: SnapshotElement;
  after?: SnapshotElement;
}

function sectionKey(s: SnapshotSection): string {
  return (s.heading || `section-${s.position}`).trim().toLowerCase();
}

export function matchSections(before: SnapshotSection[], after: SnapshotSection[]): SectionPair[] {
  const beforeByKey = new Map(before.map((s) => [sectionKey(s), s]));
  const afterByKey = new Map(after.map((s) => [sectionKey(s), s]));
  const keys = new Set([...beforeByKey.keys(), ...afterByKey.keys()]);

  const pairs: SectionPair[] = [];
  for (const key of keys) {
    pairs.push({ key, before: beforeByKey.get(key), after: afterByKey.get(key) });
  }
  return pairs.sort((a, b) => {
    const ap = a.after?.position ?? a.before?.position ?? 0;
    const bp = b.after?.position ?? b.before?.position ?? 0;
    return ap - bp;
  });
}

/** A same-slot identity signature independent of the element's current text/value. */
function slotSignature(el: SnapshotElement): string {
  return [el.tag, el.role || "", el.attributes?.href || ""].join("::");
}

export function matchElements(before: SnapshotElement[], after: SnapshotElement[]): ElementPair[] {
  const beforeRemaining = [...before];
  const afterRemaining = [...after];
  const pairs: ElementPair[] = [];

  // Pass 1: match by href (strongest signal for links/buttons that carry identity).
  matchByPredicate(beforeRemaining, afterRemaining, pairs, (a) => a.attributes?.href || null);

  // Pass 2: match remaining by identical fingerprint (unchanged content).
  matchByPredicate(beforeRemaining, afterRemaining, pairs, (a) => a.fingerprint);

  // Pass 3: match remaining by slot signature + position order (same tag/role, aligned by order).
  const bySlot = new Map<string, SnapshotElement[]>();
  for (const el of beforeRemaining) {
    const key = slotSignature(el);
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key)!.push(el);
  }
  for (const el of [...afterRemaining]) {
    const key = slotSignature(el);
    const candidates = bySlot.get(key);
    if (candidates && candidates.length > 0) {
      const match = candidates.shift()!;
      pairs.push({ before: match, after: el });
      removeFrom(beforeRemaining, match);
      removeFrom(afterRemaining, el);
    }
  }

  // Whatever is left is a pure add/remove.
  for (const el of beforeRemaining) pairs.push({ before: el, after: undefined });
  for (const el of afterRemaining) pairs.push({ before: undefined, after: el });

  return pairs;
}

function matchByPredicate(
  beforeRemaining: SnapshotElement[],
  afterRemaining: SnapshotElement[],
  pairs: ElementPair[],
  keyFn: (el: SnapshotElement) => string | null,
) {
  // Multiple elements can share the same key (e.g. several nav links all using
  // the placeholder href="#") — queue same-key candidates in document order
  // rather than overwriting, so a later duplicate doesn't silently steal an
  // earlier one's match (see diff engine unit tests for the regression case).
  const index = new Map<string, SnapshotElement[]>();
  for (const el of beforeRemaining) {
    const key = keyFn(el);
    if (!key) continue;
    if (!index.has(key)) index.set(key, []);
    index.get(key)!.push(el);
  }
  for (const el of [...afterRemaining]) {
    const key = keyFn(el);
    if (!key) continue;
    const candidates = index.get(key);
    const match = candidates?.shift();
    if (match) {
      pairs.push({ before: match, after: el });
      removeFrom(beforeRemaining, match);
      removeFrom(afterRemaining, el);
    }
  }
}

function removeFrom<T>(arr: T[], item: T) {
  const idx = arr.indexOf(item);
  if (idx >= 0) arr.splice(idx, 1);
}
