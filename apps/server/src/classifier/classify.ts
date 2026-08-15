/**
 * Deterministic classification of a matched element pair into a change type +
 * category (§48-49). No AI here — only obvious, rule-based judgments. AI later
 * only refines "meaningful vs noise" and significance, never the raw facts.
 *
 * Returns an ARRAY, not a single change: the same element can carry more
 * than one independent kind of change at once (a button whose label AND
 * color both changed) and each must surface as its own logical event —
 * functional and visual_css never overwrite each other (root-cause fix,
 * QA §19 "same element multiple change types").
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

export function classifyPair(pair: ElementPair, section: string | undefined): RawChange[] {
  const { before, after } = pair;
  const id = fingerprint(section, elementLabel(pair), before?.id, after?.id);

  if (!before && after) {
    const classification: Classification = after.tag === "img" ? "media" : INTERACTIVE_TAGS.has(after.tag) ? "functional" : "content";
    return [{
      id, changeType: "added", classification, section,
      elementLabel: elementLabel(pair), afterValue: after.text?.raw ?? after.attributes?.src,
    }];
  }

  if (before && !after) {
    const classification: Classification = before.tag === "img" ? "media" : INTERACTIVE_TAGS.has(before.tag) ? "functional" : "content";
    return [{
      id, changeType: "removed", classification, section,
      elementLabel: elementLabel(pair), beforeValue: before.text?.raw ?? before.attributes?.src,
    }];
  }

  if (!before || !after) return [];

  // Media: image src changed. Exclusive of everything else below — an <img>
  // doesn't carry the text/functional signals the rest of this function checks.
  if (before.tag === "img" || after.tag === "img") {
    if (before.attributes?.src !== after.attributes?.src) {
      return [{
        id, changeType: "modified", classification: "media", section,
        elementLabel: elementLabel(pair), beforeValue: before.attributes?.src, afterValue: after.attributes?.src,
      }];
    }
    return [];
  }

  const textChanged = (before.text?.normalized || "") !== (after.text?.normalized || "");
  const hrefChanged = (before.attributes?.href || "") !== (after.attributes?.href || "");
  const enabledChanged = before.state?.enabled !== after.state?.enabled;
  const visibleChanged = before.state?.visible !== after.state?.visible;
  const visualChanged = VISUAL_KEYS.some((k) => before.visual?.[k] !== after.visual?.[k]);

  if (!textChanged && !hrefChanged && !enabledChanged && !visibleChanged && !visualChanged) {
    return []; // unchanged — not reported
  }

  const results: RawChange[] = [];

  const isFunctional = hrefChanged || enabledChanged || visibleChanged || (INTERACTIVE_TAGS.has(after.tag) && textChanged);
  if (isFunctional) {
    results.push({
      id: fingerprint(id, "functional"), changeType: "modified", classification: "functional", section,
      elementLabel: elementLabel(pair),
      beforeValue: before.text?.raw, afterValue: after.text?.raw,
      evidence: { hrefChanged, enabledChanged, visibleChanged },
    });
  } else if (textChanged) {
    // Only reachable for a non-interactive element (a functional element's
    // text change is already captured as the functional event above — a
    // button's label change IS its functional change, not a separate
    // content one).
    results.push({
      id: fingerprint(id, "content"), changeType: "modified", classification: "content", section,
      elementLabel: elementLabel(pair),
      beforeValue: before.text?.raw, afterValue: after.text?.raw,
      evidence: { beforeNormalizedValue: before.value?.normalized, afterNormalizedValue: after.value?.normalized },
    });
  }

  // Independent of whichever branch above fired — a visual/CSS change on
  // this same element is its own event, never hidden by a functional or
  // content change happening at the same time.
  if (visualChanged) {
    results.push({
      id: fingerprint(id, "visual"), changeType: "modified", classification: "visual", section,
      elementLabel: elementLabel(pair),
      beforeValue: describeVisual(before.visual), afterValue: describeVisual(after.visual),
    });
  }

  return results;
}

function describeVisual(visual?: { color?: string; backgroundColor?: string; fontSize?: string; fontWeight?: string }): string {
  if (!visual) return "";
  return [visual.color, visual.backgroundColor, visual.fontSize, visual.fontWeight].filter(Boolean).join(" / ");
}
