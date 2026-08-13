import type { PageSnapshot, SnapshotElement, SnapshotSection } from "../src/types/snapshot.js";
import { fingerprint } from "../src/snapshot/fingerprint.js";
import { normalizeText } from "../src/snapshot/normalize.js";

let counter = 0;

export function el(overrides: Partial<Omit<SnapshotElement, "text">> & { text?: string }): SnapshotElement {
  counter++;
  const { text, ...rest } = overrides;
  const tag = rest.tag || "p";
  const role = rest.role;
  const href = rest.attributes?.href;
  const fp = fingerprint(tag, role, href, text?.slice(0, 40));
  return {
    id: fingerprint("el", counter),
    tag,
    role,
    text: text ? { raw: text, normalized: normalizeText(text).toLowerCase() } : undefined,
    state: { visible: true, enabled: true },
    visual: { color: "rgb(0,0,0)", backgroundColor: "rgb(255,255,255)", fontSize: "16px", fontWeight: "400" },
    fingerprint: fp,
    ...rest,
  };
}

export function section(heading: string | undefined, position: number, elements: SnapshotElement[]): SnapshotSection {
  return { id: fingerprint("section", position, heading), heading, position, elements };
}

export function snapshot(sections: SnapshotSection[]): PageSnapshot {
  const allElements = sections.flatMap((s) => s.elements);
  return {
    metadata: { url: "https://example.com/product", finalUrl: "https://example.com/product", title: "Test Page", capturedAt: new Date().toISOString(), status: "complete" },
    sections,
    functional: {
      buttons: allElements.filter((e) => e.tag === "button"),
      links: allElements.filter((e) => e.tag === "a"),
      states: [],
    },
    media: { images: [] },
    stats: {
      sectionCount: sections.length,
      contentElementCount: allElements.length,
      interactiveElementCount: allElements.filter((e) => ["a", "button", "input"].includes(e.tag)).length,
      imageCount: 0,
    },
  };
}
