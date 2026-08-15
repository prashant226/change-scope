import { describe, it, expect } from "vitest";
import { inferSectionTitle, looksLikeGenericLabel } from "../src/classifier/inferSectionTitle.js";
import type { RawChange } from "../src/types/change.js";

function change(before?: string, after?: string, elementLabel?: string): RawChange {
  return { id: "id", changeType: "modified", classification: "content", beforeValue: before, afterValue: after, elementLabel };
}

describe("looksLikeGenericLabel", () => {
  it("flags landmark-derived fallback labels as generic", () => {
    expect(looksLikeGenericLabel("Main")).toBe(true);
    expect(looksLikeGenericLabel("Header")).toBe(true);
    expect(looksLikeGenericLabel("General")).toBe(true);
  });

  it("does not flag real page headings as generic", () => {
    expect(looksLikeGenericLabel("Key Highlights")).toBe(false);
    expect(looksLikeGenericLabel("Product Description")).toBe(false);
  });

  it("flags a label matching the page's own title as generic (QA fix — product title used as section)", () => {
    expect(looksLikeGenericLabel("CartNest Nova Pro 5G", "CartNest Nova Pro 5G")).toBe(true);
    expect(looksLikeGenericLabel("CartNest Nova Pro 5G", "cartnest nova pro 5g")).toBe(true);
  });

  it("does not flag a specific heading just because a page title was also supplied", () => {
    expect(looksLikeGenericLabel("Customer Ratings", "CartNest Nova Pro 5G")).toBe(false);
  });

  it("flags a section that's a leading portion of a longer <title> with a spec suffix (real QA case)", () => {
    // document.title is often "<H1 text> — <spec summary>"; the H1 used as a
    // section heading is the shorter prefix, not an exact string match.
    expect(looksLikeGenericLabel("CartNest Nova Pro 5G", "CartNest Nova Pro 5G — 12GB RAM, 256GB, 120Hz AMOLED")).toBe(true);
  });

  it("does not flag a short heading that coincidentally starts the page title", () => {
    expect(looksLikeGenericLabel("Cart", "CartNest Nova Pro 5G")).toBe(false);
  });
});

describe("inferSectionTitle", () => {
  it("keeps a real heading untouched", () => {
    const title = inferSectionTitle([change("80W Fast Charging", "100W Hyper Charging")], "Key Highlights");
    expect(title).toBe("Key Highlights");
  });

  it("infers Pricing from currency + discount values under a generic label", () => {
    const changes = [change("₹49,999", "₹44,999"), change("17% off", "25% off")];
    expect(inferSectionTitle(changes, "Main")).toBe("Pricing");
  });

  it("infers Promotional details from a date range under a generic label", () => {
    const changes = [change("20–25 September", "25–30 September")];
    expect(inferSectionTitle(changes, "General")).toBe("Promotional details");
  });

  it("infers Availability from stock/purchase-action language under a generic label", () => {
    const changes = [change("In Stock", "Out of Stock"), change("Buy Now", "Notify Me")];
    expect(inferSectionTitle(changes, "Main")).toBe("Availability");
  });

  it("keeps the original label honestly when nothing matches, rather than guessing", () => {
    const changes = [change("some obscure value", "another obscure value")];
    expect(inferSectionTitle(changes, "Main")).toBe("Main");
  });

  it("infers Customer Ratings from review/rating language under a generic label", () => {
    const changes = [change("2184", "2436", "Review count")];
    expect(inferSectionTitle(changes, "Main")).toBe("Customer Ratings");
  });

  it("infers Customer Ratings when the section is just the page's own title (QA fix)", () => {
    const changes = [change("2,184 reviews", "2,436 reviews")];
    expect(inferSectionTitle(changes, "CartNest Nova Pro 5G", "CartNest Nova Pro 5G")).toBe("Customer Ratings");
  });

  it("prefers a real nearby heading over the page title when both are available", () => {
    // Not generic at all — the section already has its own specific heading, so it's left alone.
    const changes = [change("2,184 reviews", "2,436 reviews")];
    expect(inferSectionTitle(changes, "Customer Ratings", "CartNest Nova Pro 5G")).toBe("Customer Ratings");
  });
});
