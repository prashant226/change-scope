import { describe, it, expect } from "vitest";
import { buildBaselineSummary } from "../src/reports/buildBaselineSummary.js";
import { el, section, snapshot } from "./fixtures.js";

describe("buildBaselineSummary", () => {
  it("pulls page overview and stats straight from the snapshot — no fabricated fields", () => {
    const snap = snapshot([
      section("Header", 0, [el({ tag: "a", text: "Home" })]),
      section("Pricing", 1, [el({ tag: "span", text: "₹49,999" })]),
    ]);
    snap.metadata.title = "Test Product Page";
    snap.metadata.finalUrl = "https://example.com/product";

    const summary = buildBaselineSummary(snap);

    expect(summary.pageTitle).toBe("Test Product Page");
    expect(summary.finalUrl).toBe("https://example.com/product");
    expect(summary.sectionHeadings).toEqual(["Header", "Pricing"]);
    expect(summary.stats).toEqual(snap.stats);
  });

  it("omits sections with no heading rather than inventing a name for them", () => {
    const snap = snapshot([section(undefined, 0, [el({ tag: "p", text: "intro text" })])]);
    const summary = buildBaselineSummary(snap);
    expect(summary.sectionHeadings).toEqual([]);
  });
});
