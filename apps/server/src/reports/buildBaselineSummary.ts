/**
 * Builds the "what we captured" summary shown on a baseline report — pure
 * read of the generic snapshot, no invented page-type classification (§6 of
 * the baseline-report spec: don't fabricate confidence). Works for any page,
 * not just ShopKart — section headings come straight from the snapshot's
 * own structure.
 */
import type { PageSnapshot } from "../types/snapshot.js";

export interface BaselineSummary {
  pageTitle: string;
  finalUrl: string;
  capturedAt: string;
  stats: {
    sectionCount: number;
    contentElementCount: number;
    interactiveElementCount: number;
    imageCount: number;
  };
  /** Real page headings only, in document order — never invented/hardcoded section names. */
  sectionHeadings: string[];
}

export function buildBaselineSummary(snapshot: PageSnapshot): BaselineSummary {
  return {
    pageTitle: snapshot.metadata.title,
    finalUrl: snapshot.metadata.finalUrl,
    capturedAt: snapshot.metadata.capturedAt,
    stats: snapshot.stats,
    sectionHeadings: snapshot.sections.map((s) => s.heading).filter((h): h is string => Boolean(h)),
  };
}
