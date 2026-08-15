import { describe, it, expect } from "vitest";
import { computeNextRunAt } from "../src/utils/schedule.js";

describe("computeNextRunAt", () => {
  const from = "2026-01-01T00:00:00.000Z";

  it("adds 30 minutes for 30m", () => {
    expect(computeNextRunAt("30m", from)).toBe("2026-01-01T00:30:00.000Z");
  });

  it("adds one hour for 1h", () => {
    expect(computeNextRunAt("1h", from)).toBe("2026-01-01T01:00:00.000Z");
  });

  it("adds two hours for 2h", () => {
    expect(computeNextRunAt("2h", from)).toBe("2026-01-01T02:00:00.000Z");
  });

  it("adds six hours for 6h", () => {
    expect(computeNextRunAt("6h", from)).toBe("2026-01-01T06:00:00.000Z");
  });

  it("adds twelve hours for 12h", () => {
    expect(computeNextRunAt("12h", from)).toBe("2026-01-01T12:00:00.000Z");
  });

  it("adds one day for 24h", () => {
    expect(computeNextRunAt("24h", from)).toBe("2026-01-02T00:00:00.000Z");
  });
});
