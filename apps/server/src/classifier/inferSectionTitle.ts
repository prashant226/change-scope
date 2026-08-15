/**
 * Extraction assigns a section label from the nearest heading OR, failing
 * that, the nearest landmark tag (nav/header/footer/main/aside — see
 * extractPage.ts). A landmark-derived label like "Main" is honest but not
 * useful to a reader ("Main · High Impact" tells them nothing) — and a page's
 * own title is just as unhelpful as a section label when a more specific
 * heading exists nearby but wasn't marked up as an H1-H3 (a real product
 * page bug we hit in QA: a review-count change landed under the product
 * title instead of "Customer Ratings"). In both cases this infers a better
 * label from the *shape* of the values that changed — generic signals
 * (currency, date ranges, stock language, review/rating language), never
 * page-specific hardcoding. If nothing matches, the original label is kept
 * rather than inventing false certainty.
 */
import type { RawChange } from "../types/change.js";

const GENERIC_LABEL_PATTERN = /^(main|header|footer|nav|aside|general)$/i;

const CURRENCY_PATTERN = /[₹$€£]\s?[\d,]+/;
const DISCOUNT_PATTERN = /%\s?off|discount/i;
const DATE_RANGE_PATTERN = /\b\d{1,2}\s*[-–—]\s*\d{1,2}\s+[A-Za-z]+\b|\b[A-Za-z]+\s+\d{1,2}\s*[-–—]\s*\d{1,2}\b/;
const STOCK_LANGUAGE_PATTERN = /\b(in stock|out of stock|available now|unavailable|sold out|back in stock)\b/i;
const PURCHASE_ACTION_PATTERN = /\b(buy now|add to cart|notify me|checkout|out of stock)\b/i;
const REVIEW_RATING_PATTERN = /\breviews?\b|\brating\b|\/\s?5\b|\bstars?\b/i;

/**
 * A label counts as "generic" — needing inference — either because it's an
 * honest-but-useless landmark/container name, or because it's literally the
 * page's own title standing in for a section that should have a more
 * specific name. `pageTitle` is optional so this still works wherever a
 * title isn't available.
 */
export function looksLikeGenericLabel(label: string, pageTitle?: string): boolean {
  const trimmed = label.trim();
  if (GENERIC_LABEL_PATTERN.test(trimmed)) return true;
  if (pageTitle) {
    const title = pageTitle.trim().toLowerCase();
    const l = trimmed.toLowerCase();
    if (title === l) return true;
    // A page's <title> is often "<H1 heading> — <spec/detail suffix>" (e.g.
    // "CartNest Nova Pro 5G — 12GB RAM, 256GB, 120Hz AMOLED"), while the
    // section heading extracted from the DOM is just the shorter H1 text —
    // an exact match would miss this. A section that's a substantial leading
    // portion of the page title is still just page identity, not a real
    // content section. The length floor avoids coincidentally matching a
    // short, genuinely-specific heading.
    if (l.length >= 6 && title.startsWith(l)) return true;
  }
  return false;
}

export function inferSectionTitle(sectionChanges: RawChange[], fallbackLabel: string, pageTitle?: string): string {
  if (!looksLikeGenericLabel(fallbackLabel, pageTitle)) return fallbackLabel;

  const values = sectionChanges.flatMap((c) => [c.elementLabel, c.beforeValue, c.afterValue]).filter(Boolean) as string[];
  const joined = values.join(" | ");

  if (CURRENCY_PATTERN.test(joined) || DISCOUNT_PATTERN.test(joined)) {
    return "Pricing";
  }
  if (REVIEW_RATING_PATTERN.test(joined)) {
    return "Customer Ratings";
  }
  if (DATE_RANGE_PATTERN.test(joined)) {
    return "Promotional details";
  }
  if (STOCK_LANGUAGE_PATTERN.test(joined) || PURCHASE_ACTION_PATTERN.test(joined)) {
    return "Availability";
  }

  return fallbackLabel;
}
