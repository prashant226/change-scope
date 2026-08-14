/**
 * End-to-end (offline, no live API calls) test of the full
 * diff -> partition -> group -> reason -> count pipeline, replicating the
 * V1 -> V2 scenario from the diff-reasoning improvement spec: a price +
 * discount change, a promotional date range, a key-highlight spec change,
 * all under generic (landmark-derived) section labels the way a real page
 * without close headings would produce. Verifies direction, semantic
 * naming, grouping, and group-based counting all work together.
 */
import { describe, it, expect } from "vitest";
import { diffSnapshots } from "../src/diff/engine.js";
import { partitionChanges } from "../src/classifier/partition.js";
import { groupChanges } from "../src/classifier/group.js";
import { reasonAboutChanges } from "../src/ai/reason.js";
import { buildCosmeticChanges } from "../src/classifier/buildCosmeticChanges.js";
import { countGroups } from "../src/reports/countGroups.js";
import { el, section, snapshot } from "./fixtures.js";

describe("full report pipeline (V1 -> V2 style scenario)", () => {
  it("produces correctly-directed, semantically-named, grouped, and counted changes", async () => {
    const v1 = snapshot([
      section("Main", 0, [
        el({ tag: "span", text: "₹49,999" }),
        el({ tag: "span", text: "17% off" }),
      ]),
      section("General", 1, [el({ tag: "p", text: "20–25 September" })]),
      section("Key Highlights", 2, [el({ tag: "li", text: "80W Fast Charging" })]),
    ]);

    const v2 = snapshot([
      section("Main", 0, [
        el({ tag: "span", text: "₹44,999" }),
        el({ tag: "span", text: "25% off" }),
      ]),
      section("General", 1, [el({ tag: "p", text: "25–30 September" })]),
      section("Key Highlights", 2, [el({ tag: "li", text: "100W Hyper Charging" })]),
    ]);

    // previous = v1 (BEFORE), current = v2 (NOW) — the only correct call order.
    const rawChanges = diffSnapshots(v1, v2);

    const { candidates, cosmetic: cosmeticRaw } = partitionChanges(rawChanges);
    const groups = groupChanges(candidates);

    // Direction: every before/after pair must trace back to v1/v2 respectively.
    const priceRow = rawChanges.find((c) => c.afterValue === "₹44,999");
    expect(priceRow?.beforeValue).toBe("₹49,999"); // never reversed

    // Semantic naming: generic landmark labels get renamed by content shape;
    // a real heading (Key Highlights) is left untouched.
    const groupTitles = groups.map((g) => g.groupTitle).sort();
    expect(groupTitles).toEqual(["Key Highlights", "Pricing", "Promotional details"]);

    // Pricing group merges price + discount into ONE group, not two.
    const pricingGroup = groups.find((g) => g.groupTitle === "Pricing")!;
    expect(pricingGroup.changes).toHaveLength(2);

    const reasonResult = await reasonAboutChanges(groups, "Test Product", {
      apiKey: undefined, // deterministic fallback path — no live API call in tests
      tokenBudget: 6000,
      retryCount: 0,
      retryDelayMs: 0,
    });
    const allChanges = [...reasonResult.changes, ...buildCosmeticChanges(cosmeticRaw)];

    const { meaningful, cosmetic } = countGroups(allChanges);
    expect(meaningful).toBe(3); // Pricing, Promotional details, Key Highlights — not 4 raw rows
    expect(cosmetic).toBe(0);
  });

  it("keeps a cosmetic change out of the meaningful count and out of its neighboring content group", async () => {
    const v1 = snapshot([
      section("Main", 0, [
        el({ tag: "span", text: "₹49,999" }),
        el({ tag: "button", role: "button", text: "Buy Now", visual: { backgroundColor: "rgb(37,99,235)" } }),
      ]),
    ]);
    const v2 = snapshot([
      section("Main", 0, [
        el({ tag: "span", text: "₹44,999" }),
        el({ tag: "button", role: "button", text: "Buy Now", visual: { backgroundColor: "rgb(22,163,74)" } }),
      ]),
    ]);

    const rawChanges = diffSnapshots(v1, v2);
    const { candidates, cosmetic: cosmeticRaw } = partitionChanges(rawChanges);
    expect(cosmeticRaw).toHaveLength(1); // the button color change
    expect(candidates).toHaveLength(1); // the price change only

    const groups = groupChanges(candidates);
    expect(groups).toHaveLength(1);
    expect(groups[0].changes).toHaveLength(1); // the color change never joined this group

    const reasonResult = await reasonAboutChanges(groups, "Test Product", {
      apiKey: undefined,
      tokenBudget: 6000,
      retryCount: 0,
      retryDelayMs: 0,
    });
    const allChanges = [...reasonResult.changes, ...buildCosmeticChanges(cosmeticRaw)];
    const { meaningful, cosmetic } = countGroups(allChanges);
    expect(meaningful).toBe(1);
    expect(cosmetic).toBe(1);
  });
});
