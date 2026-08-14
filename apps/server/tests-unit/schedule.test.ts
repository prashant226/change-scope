import { describe, it, expect } from "vitest";
import { computeNextRunAt } from "../src/utils/schedule.js";

describe("computeNextRunAt", () => {
  const from = "2026-01-01T00:00:00.000Z";

  it("adds one hour for hourly", () => {
    expect(computeNextRunAt("hourly", from)).toBe("2026-01-01T01:00:00.000Z");
  });

  it("adds six hours for every_6_hours", () => {
    expect(computeNextRunAt("every_6_hours", from)).toBe("2026-01-01T06:00:00.000Z");
  });

  it("adds one day for daily", () => {
    expect(computeNextRunAt("daily", from)).toBe("2026-01-02T00:00:00.000Z");
  });

  it("adds seven days for weekly", () => {
    expect(computeNextRunAt("weekly", from)).toBe("2026-01-08T00:00:00.000Z");
  });
});
