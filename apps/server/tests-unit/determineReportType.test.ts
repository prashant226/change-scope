import { describe, it, expect } from "vitest";
import { determineReportType } from "../src/reports/determineReportType.js";

describe("determineReportType", () => {
  it("is 'baseline' when there is no previous snapshot", () => {
    expect(determineReportType(false)).toBe("baseline");
  });

  it("is 'comparison' when a previous snapshot exists", () => {
    expect(determineReportType(true)).toBe("comparison");
  });
});
