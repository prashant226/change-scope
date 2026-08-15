import { describe, it, expect } from "vitest";
import { isShopkartPage, retrieveShopkartContext, mergeShopkartRelatedGroups } from "../src/ai/shopkartContext.js";
import type { ChangeGroup } from "../src/types/change.js";

function group(overrides: Partial<ChangeGroup> & { groupKey: string }): ChangeGroup {
  return { groupTitle: "Section", changes: [], ...overrides };
}

describe("isShopkartPage", () => {
  it("matches the ShopKart demo URL/title, case-insensitively", () => {
    expect(isShopkartPage("https://shopkartt.lovable.app/")).toBe(true);
    expect(isShopkartPage("ShopKart Nova X Pro 5G")).toBe(true);
  });
  it("does not match unrelated pages", () => {
    expect(isShopkartPage("https://example.com/")).toBe(false);
  });
});

describe("retrieveShopkartContext", () => {
  it("returns nothing for a non-ShopKart page even if the text would otherwise match", () => {
    const groups = [group({ groupKey: "g1", section: "Pricing", changes: [{ id: "c1", changeType: "modified", classification: "content", beforeValue: "₹49,999", afterValue: "₹44,999" }] })];
    const result = retrieveShopkartContext(groups, false);
    expect(result.size).toBe(0);
  });

  it("attaches pricing guidance + constraints only to the group that actually mentions pricing", () => {
    const groups = [
      group({ groupKey: "pricing", section: "Pricing", changes: [{ id: "c1", changeType: "modified", classification: "content", beforeValue: "₹49,999", afterValue: "₹44,999" }] }),
      group({ groupKey: "unrelated", section: "Footer", changes: [{ id: "c2", changeType: "modified", classification: "content", beforeValue: "2024", afterValue: "2025" }] }),
    ];
    const result = retrieveShopkartContext(groups, true);
    expect(result.has("pricing")).toBe(true);
    expect(result.get("pricing")!.guidance.length).toBeGreaterThan(0);
    expect(result.get("pricing")!.constraints.some((c) => c.includes("business reason"))).toBe(true);
  });

  it("attaches availability guidance when stock/CTA language is present", () => {
    const groups = [
      group({
        groupKey: "avail",
        section: "Purchase",
        changes: [{ id: "c1", changeType: "modified", classification: "functional", beforeValue: "In Stock / Buy Now", afterValue: "Out of Stock / Notify Me" }],
      }),
    ];
    const result = retrieveShopkartContext(groups, true);
    expect(result.has("avail")).toBe(true);
  });
});

describe("mergeShopkartRelatedGroups", () => {
  it("does nothing for a non-ShopKart page", () => {
    const groups = [
      group({ groupKey: "a", section: "Availability", changes: [{ id: "1", changeType: "modified", classification: "content", beforeValue: "In Stock", afterValue: "Out of Stock" }] }),
      group({ groupKey: "b", section: "Purchase", changes: [{ id: "2", changeType: "modified", classification: "functional", beforeValue: "Buy Now", afterValue: "Notify Me" }] }),
    ];
    expect(mergeShopkartRelatedGroups(groups, false)).toHaveLength(2);
  });

  it("merges availability + CTA groups from different sections into one 'Product availability changed' group", () => {
    const groups = [
      group({ groupKey: "stock", section: "Stock status", changes: [{ id: "1", changeType: "modified", classification: "content", beforeValue: "In Stock", afterValue: "Out of Stock" }] }),
      group({ groupKey: "cta", section: "Purchase panel", changes: [{ id: "2", changeType: "modified", classification: "functional", beforeValue: "Buy Now", afterValue: "Notify Me" }] }),
    ];
    const merged = mergeShopkartRelatedGroups(groups, true);
    expect(merged).toHaveLength(1);
    expect(merged[0].groupTitle).toBe("Product availability changed");
    expect(merged[0].changes).toHaveLength(2);
  });

  it("merges price + discount groups into 'Pricing proposition changed'", () => {
    const groups = [
      group({ groupKey: "price", section: "Price", changes: [{ id: "1", changeType: "modified", classification: "content", beforeValue: "₹49,999", afterValue: "₹44,999" }] }),
      group({ groupKey: "discount", section: "Offer", changes: [{ id: "2", changeType: "modified", classification: "content", beforeValue: "17% off", afterValue: "25% off" }] }),
    ];
    const merged = mergeShopkartRelatedGroups(groups, true);
    expect(merged).toHaveLength(1);
    expect(merged[0].groupTitle).toBe("Pricing proposition changed");
  });

  it("leaves an unrelated group untouched", () => {
    const groups = [
      group({ groupKey: "price", section: "Price", changes: [{ id: "1", changeType: "modified", classification: "content", beforeValue: "₹49,999", afterValue: "₹44,999" }] }),
      group({ groupKey: "footer", section: "Footer", changes: [{ id: "2", changeType: "modified", classification: "content", beforeValue: "© 2024", afterValue: "© 2025" }] }),
    ];
    const merged = mergeShopkartRelatedGroups(groups, true);
    expect(merged.find((g) => g.groupKey === "footer")).toBeDefined();
  });
});
