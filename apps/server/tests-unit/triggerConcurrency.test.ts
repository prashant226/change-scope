import { describe, it, expect } from "vitest";
import { getStore } from "../src/storage/index.js";
import { triggerRun } from "../src/orchestrator/trigger.js";

describe("triggerRun — concurrency guard (§29)", () => {
  it("refuses a second run while one is already queued/running for the same monitor", async () => {
    const store = getStore();
    const monitor = await store.createMonitor({
      userId: "u1", url: "https://example.com", normalizedUrl: "https://example.com",
      schedulingEnabled: false, scheduleFrequency: "6h",
    });
    // An in-flight run, without actually invoking the orchestrator — the
    // guard is checked before any capture/AI work starts.
    await store.createRun({
      monitorId: monitor.id, userId: "u1", status: "running", triggerType: "scheduled",
      meaningfulChangeCount: 0, cosmeticChangeCount: 0, aiStatus: "pending", captureStatus: "pending",
    });

    const result = await triggerRun("u1", monitor.id, "manual");
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/already running/i);
  });

  // Note: deliberately not testing the "allows a new run once finished" path
  // here — a real triggerRun() call past the guard fires the actual
  // orchestrator (Playwright capture) as fire-and-forget, which would launch
  // a real browser during the unit test run. That path is already covered
  // by this project's live-verification passes against real monitors.
});
