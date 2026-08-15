import { describe, it, expect } from "vitest";
import { dedupeRows } from "../src/reports/reportHtml.js";
import type { AnalyzedChange } from "../src/types/change.js";

function row(overrides: Partial<AnalyzedChange>): AnalyzedChange {
  return {
    groupKey: "g",
    groupTitle: "Product images",
    changeType: "modified",
    classification: "media",
    meaningful: true,
    significance: "low",
    whatChanged: "x",
    whyItMatters: "y",
    confidence: 0.9,
    needsReview: false,
    ...overrides,
  };
}

describe("dedupeRows (QA fix — duplicate image evidence)", () => {
  it("collapses two rows with an identical before/after pair into one", () => {
    const rows = [
      row({ elementLabel: "Hero image", beforeValue: "/assets/nova-v2.jpg", afterValue: "/assets/nova-v3.jpg" }),
      row({ elementLabel: "Thumbnail", beforeValue: "/assets/nova-v2.jpg", afterValue: "/assets/nova-v3.jpg" }),
    ];
    const result = dedupeRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].elementLabel).toBe("Hero image"); // first occurrence kept
  });

  it("keeps rows with genuinely different before/after pairs", () => {
    const rows = [
      row({ elementLabel: "Price", beforeValue: "₹54,999", afterValue: "₹49,999" }),
      row({ elementLabel: "Discount", beforeValue: "15% off", afterValue: "23% off" }),
    ];
    expect(dedupeRows(rows)).toHaveLength(2);
  });

  it("leaves a single-row group untouched", () => {
    const rows = [row({ beforeValue: "a", afterValue: "b" })];
    expect(dedupeRows(rows)).toEqual(rows);
  });
});
