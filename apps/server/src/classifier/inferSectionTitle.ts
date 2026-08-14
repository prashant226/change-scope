/**
 * Extraction assigns a section label from the nearest heading OR, failing
 * that, the nearest landmark tag (nav/header/footer/main/aside — see
 * extractPage.ts). A landmark-derived label like "Main" is honest but not
 * useful to a reader ("Main · High Impact" tells them nothing). When no real
 * heading exists, this infers a better label from the *shape* of the values
 * that changed — generic signals (currency, date ranges, stock language),
 * never page-specific hardcoding. If nothing matches, the original label is
 * kept rather than inventing false certainty.
 */
import type { RawChange } from "../types/change.js";

const GENERIC_LABEL_PATTERN = /^(main|header|footer|nav|aside|general)$/i;

const CURRENCY_PATTERN = /[₹$€£]\s?[\d,]+/;
const DISCOUNT_PATTERN = /%\s?off|discount/i;
const DATE_RANGE_PATTERN = /\b\d{1,2}\s*[-–—]\s*\d{1,2}\s+[A-Za-z]+\b|\b[A-Za-z]+\s+\d{1,2}\s*[-–—]\s*\d{1,2}\b/;
const STOCK_LANGUAGE_PATTERN = /\b(in stock|out of stock|available now|unavailable|sold out|back in stock)\b/i;
const PURCHASE_ACTION_PATTERN = /\b(buy now|add to cart|notify me|checkout|out of stock)\b/i;

export function looksLikeGenericLabel(label: string): boolean {
  return GENERIC_LABEL_PATTERN.test(label.trim());
}

export function inferSectionTitle(sectionChanges: RawChange[], fallbackLabel: string): string {
  if (!looksLikeGenericLabel(fallbackLabel)) return fallbackLabel;

  const values = sectionChanges.flatMap((c) => [c.beforeValue, c.afterValue]).filter(Boolean) as string[];
  const joined = values.join(" | ");

  if (CURRENCY_PATTERN.test(joined) || DISCOUNT_PATTERN.test(joined)) {
    return "Pricing";
  }
  if (DATE_RANGE_PATTERN.test(joined)) {
    return "Promotional details";
  }
  if (STOCK_LANGUAGE_PATTERN.test(joined) || PURCHASE_ACTION_PATTERN.test(joined)) {
    return "Availability";
  }

  return fallbackLabel;
}
