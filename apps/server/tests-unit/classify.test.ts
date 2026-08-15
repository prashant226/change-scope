import { describe, it, expect } from "vitest";
import { classifyPair } from "../src/classifier/classify.js";
import { el } from "./fixtures.js";
import type { ElementPair } from "../src/diff/matchElements.js";

describe("classifyPair — CSS-only change (test matrix D)", () => {
  it("classifies a color-only change on a button as visual, with no other event", () => {
    const before = el({ tag: "button", text: "Buy Now", visual: { color: "rgb(0,0,255)", backgroundColor: "rgb(0,0,255)", fontSize: "16px", fontWeight: "400" } });
    const after = el({ tag: "button", text: "Buy Now", visual: { color: "rgb(0,128,0)", backgroundColor: "rgb(0,128,0)", fontSize: "16px", fontWeight: "400" } });
    const changes = classifyPair({ before, after }, "Purchase");
    expect(changes).toHaveLength(1);
    expect(changes[0].classification).toBe("visual");
    expect(changes[0].changeType).toBe("modified");
  });
});

describe("classifyPair — combined functional + visual (test matrix E)", () => {
  it("produces TWO independent events when label and color change on the same element, neither hiding the other", () => {
    const before = el({ tag: "button", text: "Add to Cart", visual: { color: "rgb(0,0,255)", backgroundColor: "rgb(0,0,255)", fontSize: "16px", fontWeight: "400" } });
    const after = el({ tag: "button", text: "Notify Me", visual: { color: "rgb(0,128,0)", backgroundColor: "rgb(0,128,0)", fontSize: "16px", fontWeight: "400" } });
    const changes = classifyPair({ before, after }, "Availability");

    expect(changes).toHaveLength(2);
    const functional = changes.find((c) => c.classification === "functional");
    const visual = changes.find((c) => c.classification === "visual");
    expect(functional).toBeDefined();
    expect(functional!.beforeValue).toBe("Add to Cart");
    expect(functional!.afterValue).toBe("Notify Me");
    expect(visual).toBeDefined();
    // The two events must have distinct ids — never collide/overwrite each other.
    expect(functional!.id).not.toBe(visual!.id);
  });
});

describe("classifyPair — href-only change (test matrix C, direct unit)", () => {
  it("is functional, never content, when only the href changes", () => {
    const before = el({ tag: "a", text: "Learn more", attributes: { href: "/price-protection" } });
    const after = el({ tag: "a", text: "Learn more", attributes: { href: "/purchase-protection-details" } });
    const changes = classifyPair({ before, after }, "Price Protection");
    expect(changes).toHaveLength(1);
    expect(changes[0].classification).toBe("functional");
    expect(changes[0].evidence?.hrefChanged).toBe(true);
  });
});

describe("classifyPair — plain content change", () => {
  it("classifies a non-interactive text change as content", () => {
    const before = el({ tag: "p", text: "The display looks excellent and the phone feels very responsive." });
    const after = el({ tag: "p", text: "The display looks excellent and the phone feels exceptionally responsive." });
    const changes = classifyPair({ before, after }, "Customer Ratings");
    expect(changes).toHaveLength(1);
    expect(changes[0].classification).toBe("content");
    expect(changes[0].beforeValue).toContain("very responsive");
    expect(changes[0].afterValue).toContain("exceptionally responsive");
  });
});

describe("classifyPair — unchanged element", () => {
  it("returns an empty array (not null) for a fully unchanged pair", () => {
    const before = el({ tag: "p", text: "Same text" });
    const after = el({ tag: "p", text: "Same text" });
    const changes = classifyPair({ before, after }, "Section");
    expect(changes).toEqual([]);
  });
});

describe("classifyPair — media", () => {
  it("classifies an image src change as media", () => {
    const before = el({ tag: "img", attributes: { src: "/a.jpg" } });
    const after = el({ tag: "img", attributes: { src: "/b.jpg" } });
    const changes = classifyPair({ before, after }, "Gallery");
    expect(changes).toHaveLength(1);
    expect(changes[0].classification).toBe("media");
  });
});

describe("classifyPair — add/remove", () => {
  it("still returns an array (length 1) for a pure removal", () => {
    const before = el({ tag: "p", text: "Gone now" });
    const pair: ElementPair = { before, after: undefined };
    const changes = classifyPair(pair, "Section");
    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe("removed");
  });
});
