import { describe, it, expect } from "vitest";
import { buildCosmeticChanges } from "../src/classifier/buildCosmeticChanges.js";
import type { RawChange } from "../src/types/change.js";

describe("buildCosmeticChanges", () => {
  it("converts a visual raw change directly to an AnalyzedChange without AI, marked not meaningful", () => {
    const raw: RawChange = {
      id: "btn1",
      changeType: "modified",
      classification: "visual",
      section: "Purchase",
      elementLabel: "Buy Now",
      beforeValue: "blue",
      afterValue: "green",
    };

    const [result] = buildCosmeticChanges([raw]);
    expect(result.meaningful).toBe(false);
    expect(result.significance).toBe("low");
    expect(result.whyItMatters).toMatch(/css\/formatting/i);
    expect(result.beforeValue).toBe("blue");
    expect(result.afterValue).toBe("green");
  });

  it("gives each cosmetic change its own group — never merges two into one", () => {
    const raw1: RawChange = { id: "a", changeType: "modified", classification: "visual", section: "Pricing" };
    const raw2: RawChange = { id: "b", changeType: "modified", classification: "visual", section: "Pricing" };
    const [r1, r2] = buildCosmeticChanges([raw1, raw2]);
    expect(r1.groupKey).not.toBe(r2.groupKey);
  });
});
