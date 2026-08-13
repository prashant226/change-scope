/**
 * Deterministic classification of a matched element pair into a change type +
 * category (§48-49). No AI here — only obvious, rule-based judgments. AI later
 * only refines "meaningful vs noise" and significance, never the raw facts.
 */
import type { ElementPair } from "../diff/matchElements.js";
import type { Classification, RawChange, ChangeType } from "../types/change.js";
import { fingerprint } from "../snapshot/fingerprint.js";

const INTERACTIVE_TAGS = new Set(["a", "button", "input", "select", "textarea"]);
const VISUAL_KEYS = ["color", "backgroundColor", "fontSize", "fontWeight"] as const;

function elementLabel(pair: ElementPair): string {
  const el = pair.after || pair.before;
  if (!el) return "Element";
  return el.text?.normalized?.slice(0, 60) || el.attributes?.ariaLabel || el.attributes?.alt || el.tag;
}

export function classifyPair(pair: ElementPair, section: string | undefined): RawChange | null {
  const { before, after } = pair;
  const id = fingerprint(section, elementLabel(pair), before?.id, after?.id);

  if (!before && after) {
    const classification: Classification = after.tag === "img" ? "media" : INTERACTIVE_TAGS.has(after.tag) ? "functional" : "content";
    return {
      id, changeType: "added", classification, section,
      elementLabel: elementLabel(pair), afterValue: after.text?.raw ?? after.attributes?.src,
    };
  }

  if (before && !after) {
    const classification: Classification = before.tag === "img" ? "media" : INTERACTIVE_TAGS.has(before.tag) ? "functional" : "content";
    return {
      id, changeType: "removed", classification, section,
      elementLabel: elementLabel(pair), beforeValue: before.text?.raw ?? before.attributes?.src,
    };
  }

  if (!before || !after) return null;

  // Media: image src changed.
  if (before.tag === "img" || after.tag === "img") {
    if (before.attributes?.src !== after.attributes?.src) {
      return {
        id, changeType: "modified", classification: "media", section,
        elementLabel: elementLabel(pair), beforeValue: before.attributes?.src, afterValue: after.attributes?.src,
      };
    }
    return null;
  }

  const textChanged = (before.text?.normalized || "") !== (after.text?.normalized || "");
  const hrefChanged = (before.attributes?.href || "") !== (after.attributes?.href || "");
  const enabledChanged = before.state?.enabled !== after.state?.enabled;
  const visibleChanged = before.state?.visible !== after.state?.visible;
  const visualChanged = VISUAL_KEYS.some((k) => before.visual?.[k] !== after.visual?.[k]);

  if (!textChanged && !hrefChanged && !enabledChanged && !visibleChanged && !visualChanged) {
    return null; // unchanged — not reported
  }

  if (hrefChanged || enabledChanged || visibleChanged || (INTERACTIVE_TAGS.has(after.tag) && textChanged)) {
    return {
      id, changeType: "modified", classification: "functional", section,
      elementLabel: elementLabel(pair),
      beforeValue: before.text?.raw, afterValue: after.text?.raw,
      evidence: { hrefChanged, enabledChanged, visibleChanged },
    };
  }

  if (textChanged) {
    return {
      id, changeType: "modified", classification: "content", section,
      elementLabel: elementLabel(pair),
      beforeValue: before.text?.raw, afterValue: after.text?.raw,
      evidence: { beforeNormalizedValue: before.value?.normalized, afterNormalizedValue: after.value?.normalized },
    };
  }

  if (visualChanged) {
    return {
      id, changeType: "modified", classification: "visual", section,
      elementLabel: elementLabel(pair),
      beforeValue: describeVisual(before.visual), afterValue: describeVisual(after.visual),
    };
  }

  return null;
}

function describeVisual(visual?: { color?: string; backgroundColor?: string; fontSize?: string; fontWeight?: string }): string {
  if (!visual) return "";
  return [visual.color, visual.backgroundColor, visual.fontSize, visual.fontWeight].filter(Boolean).join(" / ");
}
