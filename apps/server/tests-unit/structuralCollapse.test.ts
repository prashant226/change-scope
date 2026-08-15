import { describe, it, expect } from "vitest";
import { collapseSectionStructuralEvent } from "../src/diff/structuralCollapse.js";
import type { RawChange } from "../src/types/change.js";

function removed(id: string, label: string): RawChange {
  return { id, changeType: "removed", classification: "functional", elementLabel: label, beforeValue: label };
}
function added(id: string, label: string): RawChange {
  return { id, changeType: "added", classification: "functional", elementLabel: label, afterValue: label };
}
function modified(id: string, label: string): RawChange {
  return { id, changeType: "modified", classification: "content", elementLabel: label, beforeValue: "a", afterValue: "b" };
}

describe("collapseSectionStructuralEvent — parent section removal (§2-3)", () => {
  it("collapses 3+ wholesale-removed children into ONE structural removal event", () => {
    const changes = [
      removed("1", "CartNest Nova Pro Protective Case"),
      removed("2", "CartNest Tempered Screen Protector"),
      removed("3", "CartNest AirBeat Wireless Earbuds"),
    ];
    const result = collapseSectionStructuralEvent(changes, "Frequently Bought Together", 0);
    expect(result).toHaveLength(1);
    expect(result[0].changeType).toBe("removed");
    expect(result[0].classification).toBe("structural");
    expect(result[0].elementLabel).toBe("Section");
    expect(result[0].beforeValue).toContain("Protective Case");
    expect(result[0].beforeValue).toContain("Screen Protector");
    expect(result[0].beforeValue).toContain("Earbuds");
  });

  it("does NOT collapse a single removed child (below the collapse threshold)", () => {
    const changes = [removed("1", "Only Item")];
    const result = collapseSectionStructuralEvent(changes, "Recommendations", 0);
    expect(result).toEqual(changes);
  });

  it("does NOT collapse when the section still has content afterward (§4 — don't over-suppress)", () => {
    const changes = [removed("1", "Offer A"), removed("2", "Offer B")];
    // afterElementCount > 0 — the section wasn't emptied, just shrank.
    const result = collapseSectionStructuralEvent(changes, "Offers", 1);
    expect(result).toEqual(changes);
  });

  it("does NOT collapse when a genuine modification is mixed in alongside removals", () => {
    const changes = [removed("1", "Item A"), removed("2", "Item B"), modified("3", "Item C")];
    const result = collapseSectionStructuralEvent(changes, "Bundle", 1);
    expect(result).toEqual(changes);
  });
});

describe("collapseSectionStructuralEvent — parent replacement (§5)", () => {
  it("collapses wholesale removed+added children into ONE replacement event", () => {
    const changes = [
      removed("1", "Basic Plan"),
      removed("2", "Pro Plan"),
      added("3", "Starter Plan"),
      added("4", "Enterprise Plan"),
    ];
    const result = collapseSectionStructuralEvent(changes, "Pricing Plans", 2);
    expect(result).toHaveLength(1);
    expect(result[0].changeType).toBe("modified");
    expect(result[0].classification).toBe("structural");
    expect(result[0].beforeValue).toContain("Basic Plan");
    expect(result[0].afterValue).toContain("Starter Plan");
  });

  it("does not collapse a single swapped item (below threshold on both sides)", () => {
    const changes = [removed("1", "Old Item"), added("2", "New Item")];
    const result = collapseSectionStructuralEvent(changes, "Featured", 1);
    expect(result).toEqual(changes);
  });
});
