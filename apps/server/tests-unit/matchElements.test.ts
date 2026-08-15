import { describe, it, expect } from "vitest";
import { matchElements } from "../src/diff/matchElements.js";
import { classifyPair } from "../src/classifier/classify.js";
import { el } from "./fixtures.js";

describe("matchElements — link destination change (QA fix)", () => {
  it("matches a link by its stable visible text even when its href changes, instead of treating it as removed+added", () => {
    const before = [el({ tag: "a", text: "Learn more", attributes: { href: "#/price-protection" } })];
    const after = [el({ tag: "a", text: "Learn more", attributes: { href: "#/price-protection-details" } })];

    const pairs = matchElements(before, after);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].before).toBeDefined();
    expect(pairs[0].after).toBeDefined();

    const change = classifyPair(pairs[0], "Price Protection");
    expect(change).not.toBeNull();
    expect(change!.changeType).toBe("modified");
    expect(change!.classification).toBe("functional");
    expect(change!.evidence?.hrefChanged).toBe(true);
  });

  it("still matches by href when a link's visible text is missing/too short (icon-only link)", () => {
    const before = [el({ tag: "a", text: undefined, attributes: { href: "/cart" } })];
    const after = [el({ tag: "a", text: undefined, attributes: { href: "/cart" } })];
    const pairs = matchElements(before, after);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].before).toBeDefined();
    expect(pairs[0].after).toBeDefined();
  });

  it("still matches an unchanged link (same text, same href) as one unchanged pair, not two", () => {
    const before = [el({ tag: "a", text: "Home", attributes: { href: "/" } })];
    const after = [el({ tag: "a", text: "Home", attributes: { href: "/" } })];
    const pairs = matchElements(before, after);
    expect(pairs).toHaveLength(1);
    const change = classifyPair(pairs[0], "Nav");
    expect(change).toBeNull(); // truly unchanged — not reported
  });

  it("does not regress duplicate-href matching (multiple elements sharing href='#')", () => {
    const before = [
      el({ tag: "a", text: "One", attributes: { href: "#" } }),
      el({ tag: "a", text: "Two", attributes: { href: "#" } }),
    ];
    const after = [
      el({ tag: "a", text: "One", attributes: { href: "#" } }),
      el({ tag: "a", text: "Two", attributes: { href: "#" } }),
    ];
    const pairs = matchElements(before, after);
    expect(pairs).toHaveLength(2);
    // Each should pair with itself by text, not get scrambled by the shared href.
    for (const p of pairs) {
      expect(p.before?.text?.raw).toBe(p.after?.text?.raw);
    }
  });
});
