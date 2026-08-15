import { describe, it, expect } from "vitest";
import { MemoryStore } from "../src/storage/memoryStore.js";
import { buildMonitorSummary } from "../src/reports/monitorSummary.js";

describe("buildMonitorSummary — derivedStatus", () => {
  it("is 'pending' when the monitor has no runs yet", async () => {
    const store = new MemoryStore();
    const monitor = await store.createMonitor({
      userId: "u1", url: "https://example.com", normalizedUrl: "https://example.com",
      schedulingEnabled: false, scheduleFrequency: "daily",
    });
    const summary = await buildMonitorSummary(store, monitor);
    expect(summary.derivedStatus).toBe("pending");
  });

  it("is 'running' while the latest run is queued or running — independent of schedulingEnabled", async () => {
    const store = new MemoryStore();
    const monitor = await store.createMonitor({
      userId: "u1", url: "https://example.com", normalizedUrl: "https://example.com",
      schedulingEnabled: false, scheduleFrequency: "daily",
    });
    await store.createRun({
      monitorId: monitor.id, userId: "u1", status: "running", triggerType: "manual",
      meaningfulChangeCount: 0, cosmeticChangeCount: 0, aiStatus: "pending", captureStatus: "pending",
    });
    const summary = await buildMonitorSummary(store, monitor);
    expect(summary.derivedStatus).toBe("running");
  });

  it("is 'completed' for a completed or partial latest run", async () => {
    const store = new MemoryStore();
    const monitor = await store.createMonitor({
      userId: "u1", url: "https://example.com", normalizedUrl: "https://example.com",
      schedulingEnabled: false, scheduleFrequency: "daily",
    });
    await store.createRun({
      monitorId: monitor.id, userId: "u1", status: "partial", triggerType: "manual",
      meaningfulChangeCount: 0, cosmeticChangeCount: 0, aiStatus: "unavailable", captureStatus: "complete",
    });
    const summary = await buildMonitorSummary(store, monitor);
    expect(summary.derivedStatus).toBe("completed");
  });

  it("is 'failed' for a failed latest run", async () => {
    const store = new MemoryStore();
    const monitor = await store.createMonitor({
      userId: "u1", url: "https://example.com", normalizedUrl: "https://example.com",
      schedulingEnabled: false, scheduleFrequency: "daily",
    });
    await store.createRun({
      monitorId: monitor.id, userId: "u1", status: "failed", triggerType: "manual",
      meaningfulChangeCount: 0, cosmeticChangeCount: 0, aiStatus: "pending", captureStatus: "failed",
    });
    const summary = await buildMonitorSummary(store, monitor);
    expect(summary.derivedStatus).toBe("failed");
  });
});
