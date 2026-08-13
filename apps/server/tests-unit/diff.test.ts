import { describe, it, expect } from "vitest";
import { diffSnapshots } from "../src/diff/engine.js";
import { groupChanges } from "../src/classifier/group.js";
import { el, section, snapshot } from "./fixtures.js";

describe("diffSnapshots", () => {
  it("detects a numeric/content value change (price-like)", () => {
    const before = snapshot([section("Pricing", 0, [el({ tag: "span", text: "₹49,999" })])]);
    const after = snapshot([section("Pricing", 0, [el({ tag: "span", text: "₹44,999" })])]);

    const changes = diffSnapshots(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].classification).toBe("content");
    expect(changes[0].changeType).toBe("modified");
    expect(changes[0].beforeValue).toBe("₹49,999");
    expect(changes[0].afterValue).toBe("₹44,999");
  });

  it("detects a plain text change", () => {
    const before = snapshot([section("Description", 0, [el({ tag: "p", text: "A great phone." })])]);
    const after = snapshot([section("Description", 0, [el({ tag: "p", text: "An even better phone." })])]);

    const changes = diffSnapshots(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].classification).toBe("content");
  });

  it("detects an added section as structural", () => {
    const before = snapshot([section("Pricing", 0, [el({ tag: "span", text: "₹49,999" })])]);
    const after = snapshot([
      section("Pricing", 0, [el({ tag: "span", text: "₹49,999" })]),
      section("Offers", 1, [el({ tag: "p", text: "10% bank offer" })]),
    ]);

    const changes = diffSnapshots(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe("added");
    expect(changes[0].classification).toBe("structural");
    expect(changes[0].section).toBe("Offers");
  });

  it("detects a removed section as structural", () => {
    const before = snapshot([
      section("Pricing", 0, [el({ tag: "span", text: "₹49,999" })]),
      section("Offers", 1, [el({ tag: "p", text: "10% bank offer" })]),
    ]);
    const after = snapshot([section("Pricing", 0, [el({ tag: "span", text: "₹49,999" })])]);

    const changes = diffSnapshots(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].changeType).toBe("removed");
    expect(changes[0].classification).toBe("structural");
  });

  it("classifies an interactive element's text change as functional", () => {
    const before = snapshot([section("Purchase", 0, [el({ tag: "button", role: "button", text: "Buy Now" })])]);
    const after = snapshot([section("Purchase", 0, [el({ tag: "button", role: "button", text: "Notify Me" })])]);

    const changes = diffSnapshots(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].classification).toBe("functional");
  });

  it("classifies a visual-only change (same text, different style) as visual/CSS", () => {
    const before = snapshot([
      section("Purchase", 0, [el({ tag: "button", role: "button", text: "Buy Now", visual: { backgroundColor: "rgb(37,99,235)" } })]),
    ]);
    const after = snapshot([
      section("Purchase", 0, [el({ tag: "button", role: "button", text: "Buy Now", visual: { backgroundColor: "rgb(22,163,74)" } })]),
    ]);

    const changes = diffSnapshots(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].classification).toBe("visual");
  });

  it("detects an image src change as media", () => {
    const before = snapshot([section("Gallery", 0, [el({ tag: "img", attributes: { src: "/img/a.jpg" } })])]);
    const after = snapshot([section("Gallery", 0, [el({ tag: "img", attributes: { src: "/img/b.jpg" } })])]);

    const changes = diffSnapshots(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].classification).toBe("media");
  });

  it("produces no changes for semantically-identical (whitespace-differing) text", () => {
    const before = snapshot([section("Description", 0, [el({ tag: "p", text: "A great   phone." })])]);
    const after = snapshot([section("Description", 0, [el({ tag: "p", text: "A great phone." })])]);

    const changes = diffSnapshots(before, after);
    expect(changes).toHaveLength(0);
  });

  it("does not report spurious changes when elements are reordered", () => {
    const a = el({ tag: "li", text: "Feature A" });
    const b = el({ tag: "li", text: "Feature B" });
    const before = snapshot([section("Highlights", 0, [a, b])]);
    const after = snapshot([section("Highlights", 0, [b, a])]);

    const changes = diffSnapshots(before, after);
    expect(changes).toHaveLength(0);
  });

  it("groups multiple related changes within the same section together", () => {
    const before = snapshot([
      section("Availability", 0, [
        el({ tag: "span", text: "In Stock" }),
        el({ tag: "button", role: "button", text: "Buy Now" }),
      ]),
    ]);
    const after = snapshot([
      section("Availability", 0, [
        el({ tag: "span", text: "Out of Stock" }),
        el({ tag: "button", role: "button", text: "Notify Me" }),
      ]),
    ]);

    const changes = diffSnapshots(before, after);
    expect(changes).toHaveLength(2);

    const groups = groupChanges(changes);
    expect(groups).toHaveLength(1);
    expect(groups[0].changes).toHaveLength(2);
    expect(groups[0].groupTitle).toBe("Availability");
  });

  it("does not mismatch elements that share a non-identifying duplicate href (e.g. href=\"#\")", () => {
    // Regression test: several nav links using the common placeholder href="#"
    // must not get cross-matched with each other just because they share a key.
    const before = snapshot([
      section("Account", 0, [
        el({ tag: "a", text: "Login", attributes: { href: "#" } }),
        el({ tag: "a", text: "Orders", attributes: { href: "#" } }),
        el({ tag: "a", text: "Wishlist", attributes: { href: "#" } }),
        el({ tag: "a", text: "Cart", attributes: { href: "#" } }),
      ]),
    ]);
    const after = snapshot([
      section("Account", 0, [
        el({ tag: "a", text: "Login", attributes: { href: "#" } }),
        el({ tag: "a", text: "Orders", attributes: { href: "#" } }),
        el({ tag: "a", text: "Wishlist", attributes: { href: "#" } }),
        el({ tag: "a", text: "Cart", attributes: { href: "#" } }),
      ]),
    ]);

    expect(diffSnapshots(before, after)).toHaveLength(0);
  });

  it("matches an unchanged element (no diff) when nothing differs", () => {
    const before = snapshot([section("Pricing", 0, [el({ tag: "span", text: "₹49,999" })])]);
    const after = snapshot([section("Pricing", 0, [el({ tag: "span", text: "₹49,999" })])]);

    expect(diffSnapshots(before, after)).toHaveLength(0);
  });
});
