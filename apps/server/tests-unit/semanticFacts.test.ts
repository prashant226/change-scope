import { describe, it, expect } from "vitest";
import { consolidateDuplicateFacts, decomposeCompoundFacts, extractSemanticFacts } from "../src/classifier/semanticFacts.js";
import type { RawChange } from "../src/types/change.js";

function change(overrides: Partial<RawChange> & { id: string }): RawChange {
  return { changeType: "modified", classification: "content", ...overrides };
}

describe("consolidateDuplicateFacts — QA CartNest review count", () => {
  it("collapses a review count repeated near the title and in a ratings summary into one fact", () => {
    const changes = [
      change({ id: "a", section: "CartNest Nova Pro 5G", elementLabel: "CartNest Nova Pro 5G", beforeValue: "2,184 reviews", afterValue: "2,436 reviews" }),
      change({ id: "b", section: "CartNest Nova Pro 5G", elementLabel: "Customer Ratings", beforeValue: "Based on 2,184 reviews", afterValue: "Based on 2,436 reviews" }),
    ];
    const result = consolidateDuplicateFacts(changes, "CartNest Nova Pro 5G");
    expect(result).toHaveLength(1);
    // Prefers the section that isn't just the page's own title.
    expect(result[0].section).toBe("CartNest Nova Pro 5G"); // both candidates share this section here — see section-resolution test below for the title-vs-heading case
  });

  it("prefers a non-title section when consolidating across sections", () => {
    const changes = [
      change({ id: "a", section: "CartNest Nova Pro 5G", beforeValue: "2,184 reviews", afterValue: "2,436 reviews" }),
      change({ id: "b", section: "Customer Ratings", beforeValue: "Based on 2,184 reviews", afterValue: "Based on 2,436 reviews" }),
    ];
    const result = consolidateDuplicateFacts(changes, "CartNest Nova Pro 5G");
    expect(result).toHaveLength(1);
    expect(result[0].section).toBe("Customer Ratings");
  });

  it("consolidates a price repeated in multiple DOM locations", () => {
    const changes = [
      change({ id: "a", section: "Pricing", elementLabel: "Price", beforeValue: "₹54,999", afterValue: "₹49,999" }),
      change({ id: "b", section: "Pricing", elementLabel: "Current price", beforeValue: "Current price: ₹54,999", afterValue: "Current price: ₹49,999" }),
    ];
    const result = consolidateDuplicateFacts(changes, "Some Page");
    expect(result).toHaveLength(1);
  });

  it("does not merge unrelated facts that happen to share a domain keyword", () => {
    const changes = [
      change({ id: "a", section: "Pricing", beforeValue: "₹54,999", afterValue: "₹49,999" }),
      change({ id: "b", section: "Pricing", beforeValue: "₹1,999", afterValue: "₹1,499" }), // different price entirely
    ];
    const result = consolidateDuplicateFacts(changes, "Some Page");
    expect(result).toHaveLength(2);
  });

  it("consolidates duplicate availability signals expressed as text state, not numbers", () => {
    const changes = [
      change({ id: "a", section: "Stock", elementLabel: "Stock status", beforeValue: "In Stock", afterValue: "Out of Stock" }),
      change({ id: "b", section: "Purchase panel", elementLabel: "Availability note", beforeValue: "Available to order", afterValue: "Unavailable" }),
    ];
    // These two don't share the exact same before/after text, so they are NOT
    // consolidated — only exact-matching availability states collapse.
    const result = consolidateDuplicateFacts(changes, "Some Page");
    expect(result).toHaveLength(2);
  });

  it("consolidates two elements reporting the exact same availability state change", () => {
    const changes = [
      change({ id: "a", section: "Header", beforeValue: "In Stock", afterValue: "Out of Stock" }),
      change({ id: "b", section: "Purchase panel", beforeValue: "in stock", afterValue: "out of stock" }),
    ];
    const result = consolidateDuplicateFacts(changes, "Some Page");
    expect(result).toHaveLength(1);
  });

  it("passes through non-numeric, non-domain-matched content changes untouched", () => {
    const changes = [change({ id: "a", section: "Description", beforeValue: "old copy", afterValue: "new copy" })];
    const result = consolidateDuplicateFacts(changes, "Some Page");
    expect(result).toEqual(changes);
  });
});

describe("decomposeCompoundFacts", () => {
  it("splits a rating + review count compound element into two facts", () => {
    const changes = [change({ id: "a", section: "Customer Ratings", beforeValue: "4.4 / 5 from 2,184 reviews", afterValue: "4.4 / 5 from 2,436 reviews" })];
    const result = decomposeCompoundFacts(changes);
    // Rating (4.4 → 4.4) is unchanged, so only the review-count sub-fact survives.
    expect(result).toHaveLength(1);
    expect(result[0].elementLabel).toBe("Review count");
    expect(result[0].beforeValue).toBe("2,184");
    expect(result[0].afterValue).toBe("2,436");
  });

  it("splits into two facts when both rating and review count actually changed", () => {
    const changes = [change({ id: "a", beforeValue: "4.2 / 5 from 2,184 reviews", afterValue: "4.4 / 5 from 2,436 reviews" })];
    const result = decomposeCompoundFacts(changes);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.elementLabel).sort()).toEqual(["Rating", "Review count"]);
  });

  it("leaves a non-compound change untouched", () => {
    const changes = [change({ id: "a", beforeValue: "₹54,999", afterValue: "₹49,999" })];
    expect(decomposeCompoundFacts(changes)).toEqual(changes);
  });
});

describe("extractSemanticFacts — full CartNest V1→V2 fixture", () => {
  it("produces exactly one review-count fact from the QA scenario, decompose + consolidate combined", () => {
    const changes = [
      change({ id: "a", section: "CartNest Nova Pro 5G", elementLabel: "CartNest Nova Pro 5G", beforeValue: "2,184 reviews", afterValue: "2,436 reviews" }),
      change({ id: "b", section: "Customer Ratings", elementLabel: "Customer Ratings", beforeValue: "Based on 2,184 reviews", afterValue: "Based on 2,436 reviews" }),
      change({ id: "c", section: "Pricing", elementLabel: "Price", beforeValue: "₹54,999", afterValue: "₹49,999" }),
      change({ id: "d", section: "Pricing", elementLabel: "Discount", beforeValue: "15% off", afterValue: "23% off" }),
    ];
    const result = extractSemanticFacts(changes, "CartNest Nova Pro 5G");
    expect(result).toHaveLength(3); // review count (consolidated), price, discount
    const reviewFact = result.find((c) => (c.beforeValue || "").includes("2,184"));
    expect(reviewFact?.section).toBe("Customer Ratings");
  });
});
