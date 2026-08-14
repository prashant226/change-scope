import { describe, it, expect } from "vitest";
import { countGroups } from "../src/reports/countGroups.js";
import type { AnalyzedChange } from "../src/types/change.js";

function analyzed(groupKey: string, meaningful: boolean): AnalyzedChange {
  return {
    groupKey,
    groupTitle: "Test",
    changeType: "modified",
    classification: "content",
    meaningful,
    significance: "medium",
    whatChanged: "x changed",
    whyItMatters: "y",
    confidence: 0.9,
    needsReview: false,
  };
}

describe("countGroups", () => {
  it("counts unique groups, not raw rows — a two-row group is one meaningful change", () => {
    const changes = [
      analyzed("pricing", true),
      analyzed("pricing", true), // same group, second row (e.g. price + discount)
      analyzed("highlights", true),
      analyzed("banner-color", false),
    ];
    const { meaningful, cosmetic } = countGroups(changes);
    expect(meaningful).toBe(2); // pricing + highlights, not 3 rows
    expect(cosmetic).toBe(1);
  });

  it("returns zero counts for an empty change list", () => {
    expect(countGroups([])).toEqual({ meaningful: 0, cosmetic: 0 });
  });
});
