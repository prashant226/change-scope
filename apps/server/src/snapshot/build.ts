/**
 * Converts raw Playwright extraction into the generic PageSnapshot schema (§43-44).
 * Purely deterministic — no AI, no page-specific assumptions.
 */
import type { CaptureResult } from "../browser/capture.js";
import type {
  PageSnapshot,
  SnapshotElement,
  SnapshotSection,
} from "../types/snapshot.js";
import { normalizeText, inferValue } from "./normalize.js";
import { fingerprint } from "./fingerprint.js";

const INTERACTIVE_TAGS = new Set(["a", "button", "input", "select", "textarea"]);

function buildElement(
  raw: import("../browser/extractPage.js").RawExtractedElement,
  sectionId: string,
  orderInSection: number,
): SnapshotElement {
  const rawText = raw.text || "";
  const normalized = normalizeText(rawText);
  const value = rawText ? inferValue(rawText) : undefined;

  const id = fingerprint(sectionId, raw.tag, raw.role, orderInSection);
  // Fingerprint used for cross-snapshot matching includes content, so identical
  // elements collapse together while a changed value still lets the diff engine
  // find "the same slot" via section+tag+role+position (handled in the diff matcher).
  // For <img>, src is the primary identity signal (text/href are usually absent);
  // without it, every image on a page collapses to one fingerprint and a carousel's
  // shuffled DOM order gets misread as images "changing" into each other.
  const fp = fingerprint(
    raw.tag,
    raw.role,
    raw.attributes.href,
    raw.attributes.ariaLabel,
    raw.attributes.src,
    normalized.slice(0, 40),
  );

  return {
    id,
    tag: raw.tag,
    role: raw.role || (INTERACTIVE_TAGS.has(raw.tag) ? raw.tag : undefined),
    text: rawText ? { raw: rawText, normalized } : undefined,
    value,
    attributes: Object.keys(raw.attributes).length ? raw.attributes : undefined,
    state: { visible: raw.visible, enabled: raw.enabled },
    visual: raw.visual,
    bbox: raw.bbox,
    fingerprint: fp,
  };
}

export function buildSnapshot(url: string, capture: CaptureResult): PageSnapshot {
  const sections: SnapshotSection[] = capture.extraction.sections.map((s, sectionIndex) => {
    const sectionId = fingerprint("section", sectionIndex, s.heading);
    return {
      id: sectionId,
      heading: s.heading || undefined,
      position: sectionIndex,
      elements: s.elements.map((el, i) => buildElement(el, sectionId, i)),
    };
  });

  const allElements = sections.flatMap((s) => s.elements);
  const buttons = allElements.filter((e) => e.tag === "button" || e.role === "button");
  const links = allElements.filter((e) => e.tag === "a");
  const interactive = allElements.filter((e) => INTERACTIVE_TAGS.has(e.tag));

  const images = capture.extraction.images.map((img, i) => ({
    id: fingerprint("image", i, img.src),
    src: img.src,
    alt: img.alt || undefined,
    fingerprint: fingerprint(img.src, img.alt),
  }));

  return {
    metadata: {
      url,
      finalUrl: capture.finalUrl,
      title: capture.title,
      capturedAt: new Date().toISOString(),
      status: "complete",
    },
    sections,
    functional: {
      buttons,
      links,
      states: [],
    },
    media: { images },
    stats: {
      sectionCount: sections.length,
      contentElementCount: allElements.length,
      interactiveElementCount: interactive.length,
      imageCount: images.length,
    },
  };
}
