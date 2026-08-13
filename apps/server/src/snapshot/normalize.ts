/**
 * Content normalization (§46). We keep the raw display value for the UI and
 * attach a normalized value when we can confidently parse it — never guess.
 */
import type { ElementValue } from "../types/snapshot.js";

const CURRENCY_PATTERN = /^[₹$€£]\s?[\d,]+(\.\d+)?$/;
const NUMBER_PATTERN = /^-?[\d,]+(\.\d+)?%?$/;
const DATE_PATTERN = /\b(\d{1,2})(st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/i;

export function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function inferValue(raw: string): ElementValue {
  const trimmed = raw.trim();

  if (CURRENCY_PATTERN.test(trimmed) || (NUMBER_PATTERN.test(trimmed) && /\d/.test(trimmed))) {
    const numeric = Number(trimmed.replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(numeric)) {
      return { kind: "number", raw: trimmed, normalized: numeric };
    }
  }

  if (DATE_PATTERN.test(trimmed)) {
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return { kind: "date", raw: trimmed, normalized: new Date(parsed).toISOString().slice(0, 10) };
    }
  }

  if (/^(in stock|out of stock|available|unavailable|sold out)$/i.test(trimmed)) {
    return { kind: "boolean", raw: trimmed, normalized: !/out of stock|unavailable|sold out/i.test(trimmed) };
  }

  return { kind: "text", raw: trimmed, normalized: normalizeText(trimmed).toLowerCase() };
}
