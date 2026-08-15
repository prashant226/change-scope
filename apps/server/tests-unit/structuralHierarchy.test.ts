import { describe, it, expect } from "vitest";
import { buildParentMap, suppressDerivedSectionEvents } from "../src/diff/structuralHierarchy.js";
import { diffSnapshots } from "../src/diff/engine.js";
import { el, section, snapshot } from "./fixtures.js";
import type { RawChange } from "../src/types/change.js";

describe("buildParentMap", () => {
  it("assigns each H3 as a child of the nearest preceding H2", () => {
    const sections = [
      section("Recommended Products", 0, [], 2),
      section("Product A", 1, [], 3),
      section("Product B", 2, [], 3),
      section("Product C", 3, [], 3),
    ];
    const parentOf = buildParentMap(sections);
    expect(parentOf.get("recommended products")).toBeNull();
    expect(parentOf.get("product a")).toBe("recommended products");
    expect(parentOf.get("product b")).toBe("recommended products");
    expect(parentOf.get("product c")).toBe("recommended products");
  });

  it("treats a landmark-derived (no headingLevel) section as having no parent/child role", () => {
    const sections = [section("Header", 0, [])]; // no headingLevel passed -> undefined
    const parentOf = buildParentMap(sections);
    expect(parentOf.get("header")).toBeNull();
  });

  it("pops back to the right ancestor when levels go back up (H2 -> H3 -> H3 -> H2)", () => {
    const sections = [
      section("Section One", 0, [], 2),
      section("Sub A", 1, [], 3),
      section("Sub B", 2, [], 3),
      section("Section Two", 3, [], 2),
    ];
    const parentOf = buildParentMap(sections);
    expect(parentOf.get("sub a")).toBe("section one");
    expect(parentOf.get("sub b")).toBe("section one");
    expect(parentOf.get("section two")).toBeNull(); // sibling of Section One, not nested under it
  });
});

function structuralRemoved(label: string): RawChange {
  return { id: label, changeType: "removed", classification: "structural", section: label, elementLabel: "Section", beforeValue: label };
}

describe("suppressDerivedSectionEvents (test matrix A — parent removal)", () => {
  it("suppresses child section removals fully explained by their parent's removal", () => {
    const before = snapshot([
      section("Recommended Products", 0, [], 2),
      section("Product A", 1, [], 3),
      section("Product B", 2, [], 3),
      section("Product C", 3, [], 3),
    ]);
    const after = snapshot([]); // the whole thing is gone in V7

    const changes = [
      structuralRemoved("Recommended Products"),
      structuralRemoved("Product A"),
      structuralRemoved("Product B"),
      structuralRemoved("Product C"),
    ];
    const result = suppressDerivedSectionEvents(changes, before, after);

    expect(result).toHaveLength(1);
    expect(result[0].beforeValue).toBe("Recommended Products");
    expect(result[0].evidence?.suppressedChildSections).toEqual(["Product A", "Product B", "Product C"]);
  });

  it("does not suppress a removed section whose parent did NOT also get removed", () => {
    const before = snapshot([
      section("Recommended Products", 0, [], 2),
      section("Product A", 1, [], 3),
    ]);
    const after = snapshot([section("Recommended Products", 0, [])]); // parent survives, only child A is gone

    const changes = [structuralRemoved("Product A")];
    const result = suppressDerivedSectionEvents(changes, before, after);
    expect(result).toHaveLength(1); // kept — not derived from any removed ancestor
  });

  it("full diffSnapshots integration: parent + 3 children removed collapses to ONE logical event", () => {
    const v6 = snapshot([
      section("Recommended Products", 0, [], 2),
      section("Product A", 1, [el({ tag: "a", text: "Product A" })], 3),
      section("Product B", 2, [el({ tag: "a", text: "Product B" })], 3),
      section("Product C", 3, [el({ tag: "a", text: "Product C" })], 3),
    ]);
    const v7 = snapshot([]);

    const rawChanges = diffSnapshots(v6, v7);
    const sectionRemovals = rawChanges.filter((c) => c.changeType === "removed" && c.elementLabel === "Section");
    expect(sectionRemovals).toHaveLength(1);
    expect(sectionRemovals[0].beforeValue).toBe("Recommended Products");
  });
});
