import { describe, it, expect } from "vitest";
import { buildChangePreview } from "../src/reports/buildChangePreview.js";
import type { AnalyzedChange } from "../src/types/change.js";

function change(overrides: Partial<AnalyzedChange>): AnalyzedChange {
  return {
    groupKey: "g",
    groupTitle: "Group",
    changeType: "modified",
    classification: "content",
    meaningful: true,
    significance: "medium",
    whatChanged: "x",
    whyItMatters: "y",
    confidence: 0.9,
    needsReview: false,
    ...overrides,
  };
}

describe("buildChangePreview", () => {
  it("orders by significance, highest first", () => {
    const changes = [
      change({ groupKey: "low1", groupTitle: "Low thing", significance: "low", beforeValue: "a", afterValue: "b" }),
      change({ groupKey: "high1", groupTitle: "Pricing", significance: "high", beforeValue: "₹49,999", afterValue: "₹44,999" }),
      change({ groupKey: "med1", groupTitle: "Availability", significance: "medium", beforeValue: "In Stock", afterValue: "Out of Stock" }),
    ];
    const preview = buildChangePreview(changes);
    expect(preview.lines[0]).toBe("Pricing: ₹49,999 → ₹44,999");
    expect(preview.lines[1]).toBe("Availability: In Stock → Out of Stock");
    expect(preview.topSignificance).toBe("high");
  });

  it("caps at 2 lines by default even with more groups", () => {
    const changes = [
      change({ groupKey: "a", significance: "high" }),
      change({ groupKey: "b", significance: "high" }),
      change({ groupKey: "c", significance: "medium" }),
    ];
    expect(buildChangePreview(changes).lines).toHaveLength(2);
  });

  it("only takes one line per group, even if the group has multiple raw rows", () => {
    const changes = [
      change({ groupKey: "pricing", groupTitle: "Pricing", elementLabel: "price", beforeValue: "₹49,999", afterValue: "₹44,999" }),
      change({ groupKey: "pricing", groupTitle: "Pricing", elementLabel: "discount", beforeValue: "17% off", afterValue: "25% off" }),
    ];
    const preview = buildChangePreview(changes);
    expect(preview.lines).toHaveLength(1);
  });

  it("returns an empty preview and null significance for no changes", () => {
    const preview = buildChangePreview([]);
    expect(preview.lines).toEqual([]);
    expect(preview.topSignificance).toBeNull();
  });
});
