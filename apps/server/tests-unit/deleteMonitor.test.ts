import { describe, it, expect } from "vitest";
import { MemoryStore } from "../src/storage/memoryStore.js";

describe("MemoryStore.deleteMonitor", () => {
  it("removes the monitor and every run, snapshot, change, and log tied to it", async () => {
    const store = new MemoryStore();
    const userId = "user-1";

    const monitor = await store.createMonitor({
      userId,
      url: "https://example.com",
      normalizedUrl: "https://example.com",
      schedulingEnabled: false,
      scheduleFrequency: "24h",
    });

    const run = await store.createRun({
      monitorId: monitor.id,
      userId,
      status: "completed",
      triggerType: "manual",
      meaningfulChangeCount: 1,
      cosmeticChangeCount: 0,
      aiStatus: "completed",
      captureStatus: "complete",
    });

    await store.appendLog(run.id, {
      sequence: 0,
      timestamp: new Date().toISOString(),
      stage: "completed",
      action: "Done",
      reason: "test",
      status: "completed",
    });

    await store.saveChanges(run.id, [
      {
        groupKey: "g1",
        groupTitle: "Pricing",
        changeType: "modified",
        classification: "content",
        meaningful: true,
        significance: "high",
        whatChanged: "x",
        whyItMatters: "y",
        confidence: 0.9,
        needsReview: false,
      },
    ]);

    const snapshot = await store.saveSnapshot({
      monitorId: monitor.id,
      runId: run.id,
      versionNumber: 1,
      snapshot: {
        metadata: { url: "https://example.com", finalUrl: "https://example.com", title: "Test", capturedAt: new Date().toISOString(), status: "complete" },
        sections: [],
        functional: { buttons: [], links: [], states: [] },
        media: { images: [] },
        stats: { sectionCount: 0, contentElementCount: 0, interactiveElementCount: 0, imageCount: 0 },
      },
      contentHash: "hash",
      isSuccessful: true,
    });

    // Sanity check everything exists before deleting.
    expect(await store.getMonitor(monitor.id)).toBeDefined();
    expect(await store.getRun(run.id)).toBeDefined();
    expect(await store.getSnapshot(snapshot.id)).toBeDefined();
    expect(await store.getChanges(run.id)).toHaveLength(1);
    expect(await store.getLogs(run.id)).toHaveLength(1);

    await store.deleteMonitor(monitor.id);

    expect(await store.getMonitor(monitor.id)).toBeUndefined();
    expect(await store.getRun(run.id)).toBeUndefined();
    expect(await store.getSnapshot(snapshot.id)).toBeUndefined();
    expect(await store.getChanges(run.id)).toHaveLength(0);
    expect(await store.getLogs(run.id)).toHaveLength(0);
    expect(await store.listMonitors(userId)).toHaveLength(0);
  });

  it("does not affect other monitors' data", async () => {
    const store = new MemoryStore();
    const userId = "user-1";

    const monitorA = await store.createMonitor({
      userId, url: "https://a.example.com", normalizedUrl: "https://a.example.com",
      schedulingEnabled: false, scheduleFrequency: "24h",
    });
    const monitorB = await store.createMonitor({
      userId, url: "https://b.example.com", normalizedUrl: "https://b.example.com",
      schedulingEnabled: false, scheduleFrequency: "24h",
    });

    await store.deleteMonitor(monitorA.id);

    expect(await store.getMonitor(monitorA.id)).toBeUndefined();
    expect(await store.getMonitor(monitorB.id)).toBeDefined();
  });
});
