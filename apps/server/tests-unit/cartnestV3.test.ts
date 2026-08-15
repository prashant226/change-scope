/**
 * End-to-end (offline) replication of the CartNest V2→V3 QA scenario:
 * availability+CTA change, an offer change, "Frequently Bought Together"
 * losing all three of its products, a CSS-only color change on the same
 * CTA, and a Product Description / Specifications / Customer Ratings /
 * Q&A section reorder — all in one comparison.
 */
import { describe, it, expect } from "vitest";
import { diffSnapshots } from "../src/diff/engine.js";
import { partitionChanges } from "../src/classifier/partition.js";
import { groupChanges } from "../src/classifier/group.js";
import { el, section, snapshot } from "./fixtures.js";

function fbtProduct(text: string) {
  return el({ tag: "a", text, attributes: { href: `/product/${text.toLowerCase().replace(/\s+/g, "-")}` } });
}

describe("CartNest V2 → V3", () => {
  const v2 = snapshot([
    section("Product Description", 0, [el({ tag: "p", text: "Built for smooth everyday performance..." })]),
    section("Specifications", 1, [el({ tag: "li", text: "12GB RAM" })]),
    section("Customer Ratings", 2, [el({ tag: "span", text: "4.4 / 5" })]),
    section("Questions & Answers", 3, [el({ tag: "p", text: "Q: Does it support 5G?" })]),
    section("Availability", 4, [
      el({ tag: "span", text: "In Stock" }),
      el({ tag: "button", text: "Add to Cart" }),
      // A separate decorative badge element carries the color, distinct from
      // the button's own text/functional identity — the realistic DOM shape
      // for "the button's label changed AND its color changed" (a single
      // element only ever emits its highest-priority change; see classify.ts).
      el({ tag: "span", role: "presentation", visual: { color: "rgb(0,0,255)", backgroundColor: "rgb(255,255,255)", fontSize: "16px", fontWeight: "400" } }),
    ]),
    section("Available offers", 5, [el({ tag: "span", text: "10% off with bank card" })]),
    section("Frequently Bought Together", 6, [
      fbtProduct("CartNest Nova Pro Protective Case"),
      fbtProduct("CartNest Tempered Screen Protector"),
      fbtProduct("CartNest AirBeat Wireless Earbuds"),
    ]),
  ]);

  const v3 = snapshot([
    section("Product Description", 0, [el({ tag: "p", text: "Built for smooth everyday performance..." })]),
    section("Customer Ratings", 1, [el({ tag: "span", text: "4.4 / 5" })]),
    section("Specifications", 2, [el({ tag: "li", text: "12GB RAM" })]),
    section("Questions & Answers", 3, [el({ tag: "p", text: "Q: Does it support 5G?" })]),
    section("Availability", 4, [
      el({ tag: "span", text: "Out of Stock" }),
      el({ tag: "button", text: "Notify Me" }),
      el({ tag: "span", role: "presentation", visual: { color: "rgb(0,255,0)", backgroundColor: "rgb(255,255,255)", fontSize: "16px", fontWeight: "400" } }),
    ]),
    section("Available offers", 5, [el({ tag: "span", text: "15% off with bank card" })]),
    section("Frequently Bought Together", 6, []),
  ]);

  const rawChanges = diffSnapshots(v2, v3);
  const { candidates, cosmetic } = partitionChanges(rawChanges);
  const groups = groupChanges(candidates, v3.metadata.title);

  it("collapses Frequently Bought Together's 3 removed products into ONE structural group", () => {
    const fbtGroup = groups.find((g) => g.section === "Frequently Bought Together");
    expect(fbtGroup).toBeDefined();
    expect(fbtGroup!.changes).toHaveLength(1);
    expect(fbtGroup!.changes[0].classification).toBe("structural");
    expect(fbtGroup!.changes[0].changeType).toBe("removed");
    // No independent product-card changes anywhere else in the report.
    const allLabels = candidates.map((c) => c.elementLabel || "");
    expect(allLabels.some((l) => l.includes("Protective Case"))).toBe(false);
    expect(allLabels.some((l) => l.includes("Screen Protector"))).toBe(false);
    expect(allLabels.some((l) => l.includes("Earbuds"))).toBe(false);
  });

  it("detects the section reorder as one structural 'Page Structure' group", () => {
    const structureGroup = groups.find((g) => g.section === "Page Structure");
    expect(structureGroup).toBeDefined();
    expect(structureGroup!.changes).toHaveLength(1);
    expect(structureGroup!.changes[0].beforeValue).toContain("Specifications → Customer Ratings");
    expect(structureGroup!.changes[0].afterValue).toContain("Customer Ratings → Specifications");
  });

  it("groups availability + CTA text change together under Availability", () => {
    const availabilityGroup = groups.find((g) => g.section === "Availability");
    expect(availabilityGroup).toBeDefined();
    const values = availabilityGroup!.changes.flatMap((c) => [c.beforeValue, c.afterValue]);
    expect(values).toContain("In Stock");
    expect(values).toContain("Out of Stock");
  });

  it("reports the offer change under Available offers", () => {
    const offersGroup = groups.find((g) => g.section === "Available offers");
    expect(offersGroup).toBeDefined();
    expect(offersGroup!.changes[0].beforeValue).toContain("10%");
    expect(offersGroup!.changes[0].afterValue).toContain("15%");
  });

  it("keeps the CTA's color change classified as cosmetic (visual), separate from its functional text change", () => {
    const cosmeticLabels = cosmetic.map((c) => c.classification);
    expect(cosmeticLabels).toContain("visual");
    // The functional (Add to Cart -> Notify Me) part must NOT be in the cosmetic bucket.
    const availabilityGroup = groups.find((g) => g.section === "Availability")!;
    const functionalRow = availabilityGroup.changes.find((c) => c.classification === "functional");
    expect(functionalRow).toBeDefined();
  });

  it("produces exactly 4 logical candidate groups total (availability, offers, FBT removal, reorder)", () => {
    expect(groups).toHaveLength(4);
  });
});
