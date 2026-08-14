import { Router } from "express";
import { getStore } from "../storage/index.js";
import { validateUrlSyntax } from "../browser/urlSafety.js";
import { normalizeUrl } from "../utils/normalizeUrl.js";
import { triggerRun } from "../orchestrator/trigger.js";
import { buildAnalytics } from "../reports/analytics.js";
import { buildMonitorSummaries, buildMonitorSummary } from "../reports/monitorSummary.js";
import { computeNextRunAt } from "../utils/schedule.js";
import type { ScheduleFrequency } from "../storage/types.js";

const router = Router();
const store = getStore();

/** Fetches a monitor and 404s (never 403 — avoids confirming other users' monitor ids exist) unless it belongs to the caller. */
async function getOwnedMonitor(userId: string, monitorId: string) {
  const monitor = await store.getMonitor(monitorId);
  if (!monitor || monitor.userId !== userId) return undefined;
  return monitor;
}

// POST /api/monitors — create (or return existing) monitor for a URL.
router.post("/monitors", async (req, res) => {
  const { url, scheduleFrequency } = req.body as { url?: string; scheduleFrequency?: ScheduleFrequency };
  if (!url) return res.status(400).json({ error: "url is required" });

  const syntax = validateUrlSyntax(url);
  if (!syntax.ok) return res.status(400).json({ error: syntax.reason });

  const userId = req.userId;
  const normalized = normalizeUrl(url);
  const existing = await store.findMonitorByNormalizedUrl(userId, normalized);
  if (existing) {
    return res.status(200).json({ monitor: existing, alreadyMonitored: true });
  }

  const frequency = scheduleFrequency || "every_6_hours";
  const monitor = await store.createMonitor({
    userId,
    url,
    normalizedUrl: normalized,
    status: "active",
    scheduleFrequency: frequency,
    nextRunAt: computeNextRunAt(frequency),
  });
  return res.status(201).json({ monitor, alreadyMonitored: false });
});

router.get("/monitors", async (req, res) => {
  const monitors = await store.listMonitors(req.userId);
  const summaries = await buildMonitorSummaries(store, monitors);
  res.json({ monitors: summaries });
});

router.get("/monitors/:id", async (req, res) => {
  const monitor = await getOwnedMonitor(req.userId, req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });
  const summary = await buildMonitorSummary(store, monitor);
  res.json({ monitor: summary });
});

router.patch("/monitors/:id", async (req, res) => {
  const monitor = await getOwnedMonitor(req.userId, req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });

  const patch = { ...req.body };
  // Changing the frequency, or resuming a paused monitor, restarts the clock
  // from now rather than waiting out whatever cadence was in effect before.
  const frequencyChanged = patch.scheduleFrequency && patch.scheduleFrequency !== monitor.scheduleFrequency;
  const resumed = patch.status === "active" && monitor.status === "paused";
  if (frequencyChanged || resumed) {
    patch.nextRunAt = computeNextRunAt(patch.scheduleFrequency || monitor.scheduleFrequency);
  }

  const updated = await store.updateMonitor(req.params.id, patch);
  res.json({ monitor: updated });
});

router.get("/monitors/:id/history", async (req, res) => {
  const monitor = await getOwnedMonitor(req.userId, req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });
  const snapshots = await store.listSnapshotsForMonitor(req.params.id);
  const runs = await store.listRunsForMonitor(req.params.id);
  res.json({
    snapshots: snapshots.map((s) => ({
      id: s.id, runId: s.runId, versionNumber: s.versionNumber,
      capturedAt: s.snapshot.metadata.capturedAt, isSuccessful: s.isSuccessful,
    })),
    runs,
  });
});

// POST /api/monitors/:id/run — manual re-run of an existing monitor.
router.post("/monitors/:id/run", async (req, res) => {
  const monitor = await getOwnedMonitor(req.userId, req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });
  const result = await triggerRun(req.userId, monitor.id, "manual");
  if ("error" in result) return res.status(429).json({ error: result.error });
  res.status(202).json({ runId: result.run.id });
});

// POST /api/runs — create-or-reuse monitor for a URL and trigger a run in one call (§9, §69).
router.post("/runs", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: "url is required" });

  const syntax = validateUrlSyntax(url);
  if (!syntax.ok) return res.status(400).json({ error: syntax.reason });

  const userId = req.userId;
  const normalized = normalizeUrl(url);
  let monitor = await store.findMonitorByNormalizedUrl(userId, normalized);
  const alreadyMonitored = Boolean(monitor);
  if (!monitor) {
    monitor = await store.createMonitor({
      userId, url, normalizedUrl: normalized, status: "active", scheduleFrequency: "every_6_hours",
      nextRunAt: computeNextRunAt("every_6_hours"),
    });
  }

  const result = await triggerRun(userId, monitor.id, "manual");
  if ("error" in result) return res.status(429).json({ error: result.error });
  res.status(202).json({ runId: result.run.id, monitorId: monitor.id, alreadyMonitored });
});

router.get("/runs/:id", async (req, res) => {
  const run = await store.getRun(req.params.id);
  if (!run || run.userId !== req.userId) return res.status(404).json({ error: "Run not found" });
  res.json({ run });
});

router.get("/runs/:id/changes", async (req, res) => {
  const run = await store.getRun(req.params.id);
  if (!run || run.userId !== req.userId) return res.status(404).json({ error: "Run not found" });
  const changes = await store.getChanges(req.params.id);
  const meaningful = changes
    .filter((c) => c.meaningful)
    .sort((a, b) => rank(b.significance) - rank(a.significance));
  const cosmetic = changes.filter((c) => !c.meaningful);
  res.json({ meaningful, cosmetic });
});

router.get("/runs/:id/logs", async (req, res) => {
  const run = await store.getRun(req.params.id);
  if (!run || run.userId !== req.userId) return res.status(404).json({ error: "Run not found" });
  const logs = await store.getLogs(req.params.id);
  res.json({ logs });
});

router.get("/analytics", async (req, res) => {
  const summary = await buildAnalytics(store, req.userId);
  res.json(summary);
});

function rank(sig: "high" | "medium" | "low"): number {
  return sig === "high" ? 2 : sig === "medium" ? 1 : 0;
}

export default router;
