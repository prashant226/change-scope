import { describe, it, expect } from "vitest";
import { resolveSemanticContinuity, buildContinuityEvent } from "../src/diff/semanticContinuity.js";
import { el, section } from "./fixtures.js";

describe("resolveSemanticContinuity (§3-13)", () => {
  it("recognizes a renamed section (Key Highlights → Key Benefits) via child content overlap", () => {
    const highlights = section("Key Highlights", 4, [
      el({ tag: "li", text: "144Hz AMOLED Display" }),
      el({ tag: "li", text: "12GB RAM" }),
      el({ tag: "li", text: "256GB Storage" }),
      el({ tag: "li", text: "80W Fast Charging" }),
    ]);
    const benefits = section("Key Benefits", 2, [
      el({ tag: "li", text: "144Hz AMOLED Display" }),
      el({ tag: "li", text: "12GB RAM" }),
      el({ tag: "li", text: "256GB Storage" }),
      el({ tag: "li", text: "80W Fast Charging" }),
    ]);

    const matches = resolveSemanticContinuity([highlights], [benefits]);
    expect(matches).toHaveLength(1);
    expect(matches[0].before.heading).toBe("Key Highlights");
    expect(matches[0].after.heading).toBe("Key Benefits");
    expect(matches[0].overlapRatio).toBe(1);
  });

  it("recognizes You may also like → Recommended Products via shared product identity", () => {
    const before = section("You may also like", 5, [
      el({ tag: "a", text: "Case", attributes: { href: "/p/case" } }),
      el({ tag: "a", text: "Screen Protector", attributes: { href: "/p/screen" } }),
      el({ tag: "a", text: "Earbuds", attributes: { href: "/p/earbuds" } }),
    ]);
    const after = section("Recommended Products", 3, [
      el({ tag: "a", text: "Case", attributes: { href: "/p/case" } }),
      el({ tag: "a", text: "Screen Protector", attributes: { href: "/p/screen" } }),
      el({ tag: "a", text: "Earbuds", attributes: { href: "/p/earbuds" } }),
    ]);

    const matches = resolveSemanticContinuity([before], [after]);
    expect(matches).toHaveLength(1);
    expect(matches[0].overlapRatio).toBe(1);
  });

  it("does NOT establish continuity when content is genuinely unrelated (§19 — don't over-suppress a real replacement)", () => {
    const before = section("Old Promo", 1, [el({ tag: "p", text: "Diwali Sale — 30% off everything" })]);
    const after = section("New Feature", 1, [el({ tag: "p", text: "Introducing 5G connectivity" })]);
    expect(resolveSemanticContinuity([before], [after])).toHaveLength(0);
  });

  it("picks the strongest match (by overlap ratio) when multiple candidates partially overlap the same target", () => {
    // Only 1 of 2 elements overlaps -> ratio 0.5 (still above threshold, but weaker).
    const weak = section("Weak Match", 0, [
      el({ tag: "p", text: "shared-item-1" }),
      el({ tag: "p", text: "unrelated-weak-item" }),
    ]);
    // All 3 elements overlap -> ratio 1.0 (the real match).
    const strongBefore = section("Delivery", 1, [
      el({ tag: "p", text: "shared-item-1" }),
      el({ tag: "p", text: "shared-item-2" }),
      el({ tag: "p", text: "shared-item-3" }),
    ]);
    const strongAfter = section("Delivery Information", 0, [
      el({ tag: "p", text: "shared-item-1" }),
      el({ tag: "p", text: "shared-item-2" }),
      el({ tag: "p", text: "shared-item-3" }),
    ]);
    const matches = resolveSemanticContinuity([weak, strongBefore], [strongAfter]);
    expect(matches).toHaveLength(1);
    expect(matches[0].before.heading).toBe("Delivery");
  });

  it("buildContinuityEvent produces a structural 'moved' RawChange describing the rename", () => {
    const before = section("Coverage", 0, [el({ text: "x" })]);
    const after = section("Offers & Protection", 0, [el({ text: "x" })]);
    const [match] = resolveSemanticContinuity([before], [after]);
    const event = buildContinuityEvent(match);
    expect(event.changeType).toBe("moved");
    expect(event.classification).toBe("structural");
    expect(event.beforeValue).toBe("Coverage");
    expect(event.afterValue).toBe("Offers & Protection");
    expect(event.section).toBe("Offers & Protection");
  });
});
