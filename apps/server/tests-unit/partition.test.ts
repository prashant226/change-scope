import { describe, it, expect } from "vitest";
import { partitionChanges } from "../src/classifier/partition.js";
import type { RawChange } from "../src/types/change.js";

function change(overrides: Partial<RawChange>): RawChange {
  return { id: "id", changeType: "modified", classification: "content", ...overrides };
}

describe("partitionChanges", () => {
  it("separates visual/metadata changes from real candidates", () => {
    const content = change({ id: "c1", classification: "content", section: "Pricing" });
    const visual = change({ id: "c2", classification: "visual", section: "Pricing" });
    const functional = change({ id: "c3", classification: "functional", section: "Availability" });

    const { candidates, cosmetic } = partitionChanges([content, visual, functional]);

    expect(candidates).toEqual([content, functional]);
    expect(cosmetic).toEqual([visual]);
  });

  it("never lets a cosmetic change from a section leak into that section's AI candidates", () => {
    // Regression case: a price change (content) and a button color change
    // (visual) both live in "Pricing" — they must not be treated as one group.
    const priceChange = change({ id: "price", classification: "content", section: "Pricing", beforeValue: "₹49,999", afterValue: "₹44,999" });
    const colorChange = change({ id: "color", classification: "visual", section: "Pricing", beforeValue: "blue", afterValue: "green" });

    const { candidates, cosmetic } = partitionChanges([priceChange, colorChange]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("price");
    expect(cosmetic).toHaveLength(1);
    expect(cosmetic[0].id).toBe("color");
  });
});
