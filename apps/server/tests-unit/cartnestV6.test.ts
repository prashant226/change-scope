/**
 * End-to-end (offline) replication of the CartNest V5→V6 QA scenario: a
 * large redesign that renames/reparents several sections (Key Highlights →
 * Key Benefits, You may also like → Recommended Products, Product
 * Description → Product Details, Delivery → Delivery Information, Coverage
 * → Offers & Protection) while their underlying content stays the same,
 * plus a genuinely unchanged Customer Ratings section, a heterogeneous
 * hero section mixing availability/CTA/spec facts, and one real image
 * change.
 */
import { describe, it, expect } from "vitest";
import { diffSnapshots } from "../src/diff/engine.js";
import { partitionChanges } from "../src/classifier/partition.js";
import { extractSemanticFacts } from "../src/classifier/semanticFacts.js";
import { groupChanges } from "../src/classifier/group.js";
import { el, section, snapshot } from "./fixtures.js";

function highlightItems() {
  return [
    el({ tag: "li", text: "144Hz AMOLED Display" }),
    el({ tag: "li", text: "12GB RAM" }),
    el({ tag: "li", text: "256GB Storage" }),
    el({ tag: "li", text: "80W Fast Charging" }),
    el({ tag: "li", text: "5200mAh Battery" }),
    el({ tag: "li", text: "50MP AI Triple Camera" }),
  ];
}

function recommendedProducts() {
  return [
    el({ tag: "a", text: "Protective Case", attributes: { href: "/p/case" } }),
    el({ tag: "a", text: "Screen Protector", attributes: { href: "/p/screen" } }),
    el({ tag: "a", text: "Wireless Earbuds", attributes: { href: "/p/earbuds" } }),
  ];
}

function deliveryFacts() {
  return [
    el({ tag: "p", text: "Delivery by 3 Days" }),
    el({ tag: "p", text: "Free delivery" }),
    el({ tag: "p", text: "Order within 3 hrs to receive the earliest available delivery slot." }),
  ];
}

function protectionFacts() {
  return [
    el({ tag: "p", text: "Price protection applies to eligible purchases made during the promotional period." }),
    el({ tag: "a", text: "Learn more", attributes: { href: "#/price-protection-details" } }),
  ];
}

const v5 = snapshot([
  section("Customer Ratings", 0, [
    el({ tag: "span", text: "4.5 / 5" }),
    el({ tag: "span", text: "2,436 reviews" }),
  ]),
  section("Key Highlights", 1, highlightItems()),
  section("You may also like", 2, recommendedProducts()),
  section("Product Description", 3, [el({ tag: "p", text: "Built for smooth everyday performance..." })]),
  section("Delivery", 4, deliveryFacts()),
  section("Coverage", 5, protectionFacts()),
  section(undefined, 6, [
    // A generic (no-heading) hero bucket mixing several stable fact types —
    // none of these should end up mislabeled as "Pricing".
    el({ tag: "span", text: "Out of Stock" }),
    el({ tag: "button", text: "Notify Me" }),
    el({ tag: "span", text: "144Hz" }),
    el({ tag: "span", text: "₹49,999" }),
  ]),
  section("Product images", 7, [el({ tag: "img", attributes: { src: "/assets/nova-v5.jpg" } })]),
]);

const v6 = snapshot([
  section("Customer Ratings", 0, [
    el({ tag: "span", text: "4.5 / 5" }),
    el({ tag: "span", text: "2,436 reviews" }),
  ]),
  section("Key Benefits", 1, highlightItems()),
  section("Recommended Products", 2, recommendedProducts()),
  section("Product Details", 3, [el({ tag: "p", text: "Built for smooth everyday performance..." })]),
  section("Delivery Information", 4, deliveryFacts()),
  section("Offers & Protection", 5, protectionFacts()),
  section(undefined, 6, [
    el({ tag: "span", text: "Out of Stock" }),
    el({ tag: "button", text: "Notify Me" }),
    el({ tag: "span", text: "144Hz" }),
    el({ tag: "span", text: "₹49,999" }),
  ]),
  section("Product images", 7, [el({ tag: "img", attributes: { src: "/assets/nova-v6.jpg" } })]),
]);

describe("CartNest V5 → V6 (large redesign / semantic continuity)", () => {
  const rawChanges = diffSnapshots(v5, v6);
  const { candidates, cosmetic } = partitionChanges(rawChanges);
  const semanticCandidates = extractSemanticFacts(candidates, v6.metadata.title);
  const groups = groupChanges(semanticCandidates, v6.metadata.title);

  it("does not report a false rating/review-count change — the fact is genuinely unchanged", () => {
    const ratingGroup = groups.find((g) => g.groupTitle === "Customer Ratings");
    expect(ratingGroup).toBeUndefined(); // nothing changed there — no group at all
  });

  it("recognizes Key Highlights → Key Benefits as continuity, not remove+add", () => {
    const removed = groups.filter((g) => g.changes.some((c) => c.changeType === "removed" && c.beforeValue === "Key Highlights"));
    const added = groups.filter((g) => g.changes.some((c) => c.changeType === "added" && c.afterValue === "Key Benefits"));
    expect(removed).toHaveLength(0);
    expect(added).toHaveLength(0);

    const continuity = groups.find((g) => g.changes.some((c) => c.changeType === "moved" && c.beforeValue === "Key Highlights" && c.afterValue === "Key Benefits"));
    expect(continuity).toBeDefined();
  });

  it("recognizes You may also like → Recommended Products as continuity", () => {
    const continuity = groups.find((g) => g.changes.some((c) => c.changeType === "moved" && c.beforeValue === "You may also like" && c.afterValue === "Recommended Products"));
    expect(continuity).toBeDefined();
  });

  it("recognizes Product Description → Product Details as continuity", () => {
    const continuity = groups.find((g) => g.changes.some((c) => c.changeType === "moved" && c.beforeValue === "Product Description" && c.afterValue === "Product Details"));
    expect(continuity).toBeDefined();
  });

  it("recognizes Delivery → Delivery Information as continuity", () => {
    const continuity = groups.find((g) => g.changes.some((c) => c.changeType === "moved" && c.beforeValue === "Delivery" && c.afterValue === "Delivery Information"));
    expect(continuity).toBeDefined();
  });

  it("recognizes Coverage → Offers & Protection as continuity", () => {
    const continuity = groups.find((g) => g.changes.some((c) => c.changeType === "moved" && c.beforeValue === "Coverage" && c.afterValue === "Offers & Protection"));
    expect(continuity).toBeDefined();
  });

  it("never classifies availability, CTA, or specification facts as Pricing", () => {
    const pricingGroup = groups.find((g) => g.groupTitle === "Pricing");
    // Price itself didn't change in this fixture, so there may be no Pricing
    // group at all — the important assertion is that IF one exists, it must
    // never contain the availability/CTA/spec facts.
    if (pricingGroup) {
      const labels = pricingGroup.changes.map((c) => c.elementLabel);
      expect(labels.some((l) => l?.includes("Out of Stock") || l?.includes("Notify Me") || l?.includes("144Hz"))).toBe(false);
    }
    const availabilityGroup = groups.find((g) => g.groupTitle === "Availability");
    const specGroup = groups.find((g) => g.groupTitle === "Specifications");
    // Since none of these values actually changed, no groups should exist for them at all.
    expect(availabilityGroup).toBeUndefined();
    expect(specGroup).toBeUndefined();
  });

  it("detects the real product image change exactly once", () => {
    const imageChanges = candidates.filter((c) => c.classification === "media");
    expect(imageChanges).toHaveLength(1);
    expect(imageChanges[0].beforeValue).toBe("/assets/nova-v5.jpg");
    expect(imageChanges[0].afterValue).toBe("/assets/nova-v6.jpg");
  });

  it("produces a compact set of logical groups, not one per raw structural difference", () => {
    // 5 continuity events (Key Benefits, Recommended Products, Product
    // Details, Delivery Information, Offers & Protection) + image change.
    // No Pricing/Availability/Specifications/Customer Ratings noise since
    // none of those facts actually changed.
    expect(groups.length).toBeLessThanOrEqual(6);
  });

  it("cosmetic partition is unaffected (no CSS in this fixture, sanity check)", () => {
    expect(cosmetic).toHaveLength(0);
  });
});
