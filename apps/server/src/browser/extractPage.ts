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

  function meaningfulText(el: Element): string {
    // Prefer direct text; fall back to full textContent for atomic elements (buttons/links/labels).
    const direct = directText(el);
    if (direct) return direct;
    if (["BUTTON", "A", "LABEL", "STRONG", "EM", "SMALL"].includes(el.tagName)) {
      return (el.textContent || "").trim().slice(0, 300);
    }
    return "";
  }

  const allEls = Array.from(document.body.querySelectorAll<HTMLElement>("*"));

  const sections: RawExtractedSection[] = [];
  let current: RawExtractedSection = { heading: null, position: 0, elements: [] };
  sections.push(current);

  for (const el of allEls) {
    if (!CONTENT_TAGS.has(el.tagName)) continue;
    if (!isVisible(el)) continue;

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
