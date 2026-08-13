import { describe, it, expect } from "vitest";
import { reasonAboutChanges } from "../src/ai/reason.js";
import { aiResponseSchema } from "../src/ai/schema.js";
import type { ChangeGroup } from "../src/types/change.js";

const sampleGroup: ChangeGroup = {
  groupKey: "g1",
  groupTitle: "Pricing",
  section: "Pricing",
  changes: [
    { id: "c1", changeType: "modified", classification: "content", section: "Pricing", elementLabel: "Price", beforeValue: "₹49,999", afterValue: "₹44,999" },
  ],
};

describe("AI reasoning fallback (§58)", () => {
  it("falls back to deterministic facts with no API key configured, without fabricating interpretation", async () => {
    const result = await reasonAboutChanges([sampleGroup], "Test Product", {
      apiKey: undefined,
      tokenBudget: 6000,
      retryCount: 0,
      retryDelayMs: 0,
    });

    expect(result.aiUnavailable).toBe(true);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].whyItMatters).toBe("AI significance analysis is temporarily unavailable.");
    expect(result.changes[0].beforeValue).toBe("₹49,999");
    expect(result.changes[0].afterValue).toBe("₹44,999");
  });

  it("returns no changes and does not fail when there are no groups to reason about", async () => {
    const result = await reasonAboutChanges([], "Test Product", {
      apiKey: undefined,
      tokenBudget: 6000,
      retryCount: 0,
      retryDelayMs: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.changes).toHaveLength(0);
  });
});

describe("AI response schema validation (§55)", () => {
  it("accepts a well-formed response", () => {
    const parsed = aiResponseSchema.safeParse({
      changes: [
        { groupKey: "g1", groupTitle: "Pricing", meaningful: true, significance: "high", confidence: 0.9, whyItMatters: "Price dropped ~10%." },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a response with an invalid significance value", () => {
    const parsed = aiResponseSchema.safeParse({
      changes: [
        { groupKey: "g1", groupTitle: "Pricing", meaningful: true, significance: "extreme", confidence: 0.9, whyItMatters: "x" },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a response missing required fields", () => {
    const parsed = aiResponseSchema.safeParse({ changes: [{ groupKey: "g1" }] });
    expect(parsed.success).toBe(false);
  });
});
