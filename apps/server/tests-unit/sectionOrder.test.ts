import { describe, it, expect } from "vitest";
import { detectSectionReorder } from "../src/diff/sectionOrder.js";
import { el, section } from "./fixtures.js";

describe("detectSectionReorder (§6-11)", () => {
  it("detects the CartNest V2→V3 reorder as ONE event, not remove+add", () => {
    const before = [
      section("Product Description", 0, [el({ text: "desc" })]),
      section("Specifications", 1, [el({ text: "spec" })]),
      section("Customer Ratings", 2, [el({ text: "4.4" })]),
      section("Questions & Answers", 3, [el({ text: "Q&A" })]),
    ];
    const after = [
      section("Product Description", 0, [el({ text: "desc" })]),
      section("Customer Ratings", 1, [el({ text: "4.4" })]),
      section("Specifications", 2, [el({ text: "spec" })]),
      section("Questions & Answers", 3, [el({ text: "Q&A" })]),
    ];
    const result = detectSectionReorder(before, after);
    expect(result).not.toBeNull();
    expect(result!.changeType).toBe("moved");
    expect(result!.classification).toBe("structural");
    expect(result!.beforeValue).toBe("Product Description → Specifications → Customer Ratings → Questions & Answers");
    expect(result!.afterValue).toBe("Product Description → Customer Ratings → Specifications → Questions & Answers");
  });

  it("returns null when section order is unchanged", () => {
    const before = [section("A", 0, [el({ text: "a" })]), section("B", 1, [el({ text: "b" })])];
    const after = [section("A", 0, [el({ text: "a" })]), section("B", 1, [el({ text: "b" })])];
    expect(detectSectionReorder(before, after)).toBeNull();
  });

  it("does not fire for a section added/removed (not a reorder — that's handled elsewhere)", () => {
    const before = [section("A", 0, [el({ text: "a" })])];
    const after = [section("A", 0, [el({ text: "a" })]), section("B", 1, [el({ text: "b" })])];
    // Only one common section — not enough to establish "order" changed.
    expect(detectSectionReorder(before, after)).toBeNull();
  });

  it("ignores sections without a real heading when establishing order (position-fallback labels aren't stable identity)", () => {
    const before = [section(undefined, 0, [el({ text: "x" })]), section("Real Heading", 1, [el({ text: "y" })])];
    const after = [section("Real Heading", 0, [el({ text: "y" })]), section(undefined, 1, [el({ text: "x" })])];
    // Only one heading-bearing section is common — no order comparison possible.
    expect(detectSectionReorder(before, after)).toBeNull();
  });
});
