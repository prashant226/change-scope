/**
 * Runs inside the page via page.evaluate(). Must be a plain, serializable function —
 * no imports, no closures over Node-side variables. Produces a generic, page-agnostic
 * extraction: headings become section boundaries, everything else is generic content.
 *
 * MASTER BUILD PROMPT §43/§44: nothing here may special-case any particular site.
 */
export interface RawExtractedElement {
  tag: string;
  role: string | null;
  text: string | null;
  attributes: Record<string, string>;
  visible: boolean;
  enabled: boolean;
  visual: {
    display: string;
    visibility: string;
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontWeight: string;
    width: number;
    height: number;
  };
  bbox: { x: number; y: number; width: number; height: number };
}

export interface RawExtractedSection {
  heading: string | null;
  position: number;
  elements: RawExtractedElement[];
}

export interface RawExtractedImage {
  src: string;
  alt: string | null;
}

export interface RawExtractionResult {
  title: string;
  sections: RawExtractedSection[];
  images: RawExtractedImage[];
}

/**
 * These constants are declared *inside* extractPage (rather than at module
 * scope) on purpose: this function is serialized via `.toString()` and
 * evaluated inside the page context (see capture.ts's serializeForBrowser),
 * so nothing it relies on may live outside its own function body.
 */
export function extractPage(): RawExtractionResult {
  const CONTENT_TAGS = new Set([
    "H1", "H2", "H3", "H4", "H5", "H6",
    "P", "SPAN", "LI", "TD", "TH", "LABEL", "STRONG", "EM", "SMALL",
    "A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "IMG",
  ]);

  const SECTION_HEADING_TAGS = new Set(["H1", "H2", "H3"]);

  function isVisible(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function directText(el: Element): string {
    let text = "";
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent || "";
    }
    return text.trim();
  }

  // Does this element have any descendant that CONTENT_TAGS would itself
  // walk into and capture separately? Used below to decide whether a block
  // text container is safe to read via full textContent — if something
  // inside it will already be captured on its own, falling back here would
  // duplicate that same text at two nesting levels.
  function hasCapturableDescendant(el: Element): boolean {
    for (const child of Array.from(el.children)) {
      if (CONTENT_TAGS.has(child.tagName)) return true;
      if (hasCapturableDescendant(child)) return true;
    }
    return false;
  }

  function meaningfulText(el: Element): string {
    // Prefer direct text; fall back to full textContent for atomic elements (buttons/links/labels).
    const direct = directText(el);
    if (direct) return direct;
    if (["BUTTON", "A", "LABEL", "STRONG", "EM", "SMALL"].includes(el.tagName)) {
      return (el.textContent || "").trim().slice(0, 300);
    }
    // A block-level text container (paragraph/quote/list item — the common
    // shape for review/testimonial copy) whose text sits inside a wrapper
    // tag that isn't independently captured (e.g. <i>, <q>, a plain <div>)
    // would otherwise be silently skipped entirely, since directText() only
    // sees the container's own text nodes. Fall back to the container's
    // full text — but only when nothing inside it will be captured as its
    // own element, or the same text would be reported twice.
    if (["P", "BLOCKQUOTE", "Q", "LI"].includes(el.tagName) && !hasCapturableDescendant(el)) {
      return (el.textContent || "").trim().slice(0, 300);
    }
    return "";
  }

  const allEls = Array.from(document.body.querySelectorAll<HTMLElement>("*"));

  const sections: RawExtractedSection[] = [];
  let current: RawExtractedSection = { heading: null, position: 0, elements: [] };
  sections.push(current);

  // Many client-rendered nav/footer regions have no <h1-3> heading at all, so
  // without this they'd all collapse into one shared "General" bucket — which
  // makes element matching far more prone to false positives when their DOM
  // order shifts slightly between two captures (see diff/matchElements.ts).
  // Landmark tags give those regions their own stable section identity too.
  function nearestLandmarkKey(el: Element): string | null {
    const landmark = el.closest("nav, header, footer, aside, main");
    if (!landmark) return null;
    const label = landmark.getAttribute("aria-label");
    return label ? `${landmark.tagName}:${label}` : landmark.tagName;
  }

  let currentLandmarkKey: string | null = null;

  for (const el of allEls) {
    if (!CONTENT_TAGS.has(el.tagName)) continue;
    if (!isVisible(el)) continue;

    const landmarkKey = nearestLandmarkKey(el);
    if (landmarkKey !== currentLandmarkKey) {
      currentLandmarkKey = landmarkKey;
      if (landmarkKey) {
        const [tag, label] = landmarkKey.split(":");
        const niceLabel = label || tag.charAt(0) + tag.slice(1).toLowerCase();
        current = { heading: niceLabel, position: sections.length, elements: [] };
        sections.push(current);
      }
    }

    if (SECTION_HEADING_TAGS.has(el.tagName)) {
      const headingText = (el.textContent || "").trim().slice(0, 200);
      if (headingText) {
        current = { heading: headingText, position: sections.length, elements: [] };
        sections.push(current);
        continue; // heading itself becomes the section title, not a content element
      }
    }

    const text = meaningfulText(el);
    const isInteractive = ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
    const isImage = el.tagName === "IMG";
    if (!text && !isInteractive && !isImage) continue;

    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    const attributes: Record<string, string> = {};
    const href = el.getAttribute("href");
    const ariaLabel = el.getAttribute("aria-label");
    const alt = el.getAttribute("alt");
    const src = el.getAttribute("src");
    const value = (el as HTMLInputElement).value;
    if (href) attributes.href = href;
    if (ariaLabel) attributes.ariaLabel = ariaLabel;
    if (alt) attributes.alt = alt;
    if (src) attributes.src = src;
    if (value) attributes.value = value;

    current.elements.push({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || null,
      text: text || null,
      attributes,
      visible: true,
      enabled: !(el as HTMLButtonElement).disabled,
      visual: {
        display: style.display,
        visibility: style.visibility,
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      bbox: {
        x: Math.round(rect.x),
        y: Math.round(rect.y + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
  }

  const images: RawExtractedImage[] = Array.from(document.querySelectorAll("img"))
    .filter((img) => isVisible(img))
    .map((img) => ({ src: img.src, alt: img.getAttribute("alt") }));

  return {
    title: document.title,
    sections: sections.filter((s) => s.elements.length > 0 || s.heading),
    images,
  };
}
