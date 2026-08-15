import { describe, it, expect } from "vitest";
import { groupChanges } from "../src/classifier/group.js";
import type { RawChange } from "../src/types/change.js";

function change(overrides: Partial<RawChange> & { id: string }): RawChange {
  return { changeType: "modified", classification: "content", section: "Main", ...overrides };
}

describe("groupChanges — fact-type splitting for heterogeneous generic sections (§14-15)", () => {
  it("splits availability/CTA/specification facts into separate groups instead of lumping them under Pricing", () => {
    const changes: RawChange[] = [
      change({ id: "a", elementLabel: "Availability", beforeValue: "In Stock", afterValue: "Out of Stock" }),
      change({ id: "b", elementLabel: "CTA", classification: "functional", beforeValue: "Buy Now", afterValue: "Notify Me" }),
      change({ id: "c", elementLabel: "Display", beforeValue: "120Hz", afterValue: "144Hz" }),
      change({ id: "d", elementLabel: "Price", beforeValue: "₹54,999", afterValue: "₹49,999" }),
    ];
    const groups = groupChanges(changes, "CartNest Nova Pro 5G");
    const titles = groups.map((g) => g.groupTitle).sort();
    expect(titles).toEqual(["Availability", "Pricing", "Specifications"]);

    const pricing = groups.find((g) => g.groupTitle === "Pricing")!;
    expect(pricing.changes).toHaveLength(1);
    expect(pricing.changes[0].elementLabel).toBe("Price");

    const availability = groups.find((g) => g.groupTitle === "Availability")!;
    expect(availability.changes).toHaveLength(2); // availability text + CTA grouped together
  });

  it("still groups price + discount together as one Pricing group (no regression)", () => {
    const changes: RawChange[] = [
      change({ id: "a", elementLabel: "Price", beforeValue: "₹54,999", afterValue: "₹49,999" }),
      change({ id: "b", elementLabel: "Discount", beforeValue: "15% off", afterValue: "23% off" }),
    ];
    const groups = groupChanges(changes);
    expect(groups).toHaveLength(1);
    expect(groups[0].groupTitle).toBe("Pricing");
    expect(groups[0].changes).toHaveLength(2);
  });

  it("still groups rating + review count together as one Customer Ratings group (no regression)", () => {
    const changes: RawChange[] = [
      change({ id: "a", elementLabel: "Rating", beforeValue: "4.4", afterValue: "4.5" }),
      change({ id: "b", elementLabel: "Review count", beforeValue: "2184", afterValue: "2436" }),
    ];
    const groups = groupChanges(changes);
    expect(groups).toHaveLength(1);
    expect(groups[0].groupTitle).toBe("Customer Ratings");
  });

  it("does not split a section that already has a real, specific heading", () => {
    const changes: RawChange[] = [
      change({ id: "a", section: "Key Highlights", elementLabel: "Display", beforeValue: "120Hz", afterValue: "144Hz" }),
      change({ id: "b", section: "Key Highlights", elementLabel: "Price note", beforeValue: "₹54,999", afterValue: "₹49,999" }),
    ];
    const groups = groupChanges(changes);
    expect(groups).toHaveLength(1);
    expect(groups[0].groupTitle).toBe("Key Highlights"); // real heading always wins, never split
  });

  it("leaves a single-fact-type generic section on the normal content-shape inference path", () => {
    const changes: RawChange[] = [
      change({ id: "a", elementLabel: "Display", beforeValue: "120Hz", afterValue: "144Hz" }),
      change({ id: "b", elementLabel: "Charging", beforeValue: "67W", afterValue: "80W" }),
    ];
    const groups = groupChanges(changes);
    expect(groups).toHaveLength(1);
    expect(groups[0].groupTitle).toBe("Specifications");
  });
});
