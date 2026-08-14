import { describe, it, expect } from "vitest";
import { inferSectionTitle, looksLikeGenericLabel } from "../src/classifier/inferSectionTitle.js";
import type { RawChange } from "../src/types/change.js";

function change(before?: string, after?: string): RawChange {
  return { id: "id", changeType: "modified", classification: "content", beforeValue: before, afterValue: after };
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
});
