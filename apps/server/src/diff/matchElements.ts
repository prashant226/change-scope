/**
 * Stable element matching across two snapshots (§47) — this is
 * `matchLogicalEntity()` for elements (matchSections is its section-level
 * counterpart): four signals, checked in priority order, never raw DOM
 * index. The last of these (slot signature + local sibling index) is the
 * generic mechanism repeated-card content relies on for stable identity —
 * "the 2nd review card" rather than "review #47 in the whole document" —
 * see matchElements()'s Pass 4 below.
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

/**
 * Stable section identity — a real heading, never DOM index/position alone.
 * Exported so other structural analyses (e.g. diff/sectionOrder.ts) key
 * sections the exact same way matchSections does, instead of re-deriving
 * their own notion of "same section" and risking it drifting out of sync.
 */
export function sectionKey(s: SnapshotSection): string {
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

/**
 * A same-slot identity signature independent of the element's current
 * text/value — tag + role + href only. Elements sharing this signature
 * within one section (e.g. every review body: `p::::`) are paired up in
 * local document order (see the "local sibling index" pass below), which
 * is exactly the stable-identity mechanism repeated content — review
 * cards, product cards, list items — needs: "the Nth item of this shape
 * in this section," never a raw global DOM index.
 */
function slotSignature(el: SnapshotElement): string {
  return [el.tag, el.role || "", el.attributes?.href || ""].join("::");
}

/**
 * A same-label identity signature independent of href — the visible text of
 * a link/button ("Learn more") is usually a *stronger* identity signal than
 * its destination, precisely because the destination is exactly the kind of
 * attribute that legitimately changes (a "Learn more" link getting
 * repointed at a more specific page) while the label stays put. Only
 * meaningful (non-trivial) text counts, so this never fires for icon-only
 * or near-empty elements where text isn't a reliable identity signal.
 */
function textSignature(el: SnapshotElement): string | null {
  const text = el.text?.normalized;
  if (!text || String(text).length < 3) return null;
  return [el.tag, el.role || "", text].join("::");
}

export function matchElements(before: SnapshotElement[], after: SnapshotElement[]): ElementPair[] {
  const beforeRemaining = [...before];
  const afterRemaining = [...after];
  const pairs: ElementPair[] = [];

  // Pass 1: match by visible label first — see textSignature. This must run
  // before the href pass so a link whose destination changed (but whose
  // visible text didn't) is recognized as the same element with a changed
  // attribute, not paired away by an unrelated href match or left stranded
  // as a remove+add.
  matchByPredicate(beforeRemaining, afterRemaining, pairs, (a) => textSignature(a));

  // Pass 2: match remaining by href (identity signal for icon-only links/buttons with no usable text).
  matchByPredicate(beforeRemaining, afterRemaining, pairs, (a) => a.attributes?.href || null);

  // Pass 3: match remaining by identical fingerprint (unchanged content).
  matchByPredicate(beforeRemaining, afterRemaining, pairs, (a) => a.fingerprint);

  // Pass 4: local sibling index — match remaining elements by slot signature
  // (same tag/role/href "shape"), paired in document order within that
  // shape. This is what lets "review card #2's text changed" survive as one
  // modified entity instead of a remove+add, without ever hard-coding what
  // a "review" is — it works for any repeated content shape generically.
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
