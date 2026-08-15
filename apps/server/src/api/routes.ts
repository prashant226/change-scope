import { Router } from "express";
import { getStore } from "../storage/index.js";
import { validateUrlSyntax } from "../browser/urlSafety.js";
import { normalizeUrl } from "../utils/normalizeUrl.js";
import { triggerRun } from "../orchestrator/trigger.js";
import { reconcileStaleRun } from "../orchestrator/reconcileStaleRun.js";
import { buildAnalytics } from "../reports/analytics.js";
import { buildMonitorSummaries, buildMonitorSummary } from "../reports/monitorSummary.js";
import { computeNextRunAt } from "../utils/schedule.js";
import { buildReportHtml } from "../reports/reportHtml.js";
import { renderHtmlToPdf } from "../reports/renderPdf.js";
import { buildBaselineSummary } from "../reports/buildBaselineSummary.js";
import { buildChangePreview } from "../reports/buildChangePreview.js";
import type { MonitorRecord, ScheduleFrequency } from "../storage/types.js";

const router = Router();
const store = getStore();

// Express 4 does not catch a rejected promise thrown inside an async route
// handler — it becomes an unhandled rejection at the process level, which
// crashes the entire server (observed live: a single failing DB query took
// the whole app down, not just that one request). Wrapping every handler
// here routes the error into the existing error-handling middleware in
// index.ts instead, so one bad request becomes a normal 500 response.
for (const method of ["get", "post", "patch", "delete"] as const) {
  const original = router[method].bind(router);
  router[method] = ((path: string, handler: (req: unknown, res: unknown, next: unknown) => unknown) =>
    original(path, (req: unknown, res: unknown, next: (err?: unknown) => void) => {
      Promise.resolve(handler(req, res, next)).catch(next);
    })) as typeof router[typeof method];
}

/** Fetches a monitor and 404s (never 403 — avoids confirming other users' monitor ids exist) unless it belongs to the caller. */
async function getOwnedMonitor(userId: string, monitorId: string) {
  const monitor = await store.getMonitor(monitorId);
  if (!monitor || monitor.userId !== userId) return undefined;
  return monitor;
}

// POST /api/monitors — create (or return existing) monitor for a URL. The
// Add Monitor modal now configures URL + check frequency in one step, so
// schedulingEnabled/scheduleFrequency come from the caller — omitting them
// falls back to scheduling off, for any other caller that just wants a
// monitor record with no schedule. Never creates a duplicate: an existing
// normalized URL is returned as-is (untouched) so the caller can decide
// whether to update its schedule instead (see PATCH below).
router.post("/monitors", async (req, res) => {
  const { url, schedulingEnabled, scheduleFrequency } = req.body as {
    url?: string;
    schedulingEnabled?: boolean;
    scheduleFrequency?: ScheduleFrequency;
  };
  if (!url) return res.status(400).json({ error: "url is required" });

  const syntax = validateUrlSyntax(url);
  if (!syntax.ok) return res.status(400).json({ error: syntax.reason });

  const userId = req.userId;
  const normalized = normalizeUrl(url);
  const existing = await store.findMonitorByNormalizedUrl(userId, normalized);
  if (existing) {
    return res.status(200).json({ monitor: existing, alreadyMonitored: true });
  }

  const frequency = scheduleFrequency || "6h";
  const monitor = await store.createMonitor({
    userId,
    url,
    normalizedUrl: normalized,
    schedulingEnabled: Boolean(schedulingEnabled),
    scheduleFrequency: frequency,
    ...(schedulingEnabled ? { nextRunAt: computeNextRunAt(frequency) } : {}),
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

// PATCH /api/monitors/:id — title, and/or the scheduler (Monitor → Settings
// only, §11). Scheduling on/off and run status are unrelated concepts: this
// route never touches the monitor's scan-state, only scheduling fields.
router.patch("/monitors/:id", async (req, res) => {
  const monitor = await getOwnedMonitor(req.userId, req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });

  const body = req.body as { title?: string; schedulingEnabled?: boolean; scheduleFrequency?: ScheduleFrequency };
  const patch: Partial<MonitorRecord> = {};
  if (body.title !== undefined) patch.title = body.title;

  if (body.schedulingEnabled === true) {
    // Turning scheduling on (or changing frequency while it's already on)
    // always restarts the clock from now, rather than reusing whatever
    // next-check time happened to be sitting there from before.
    const frequency = body.scheduleFrequency || monitor.scheduleFrequency;
    patch.schedulingEnabled = true;
    patch.scheduleFrequency = frequency;
    patch.nextRunAt = computeNextRunAt(frequency);
  } else if (body.schedulingEnabled === false) {
    patch.schedulingEnabled = false;
    // nextRunAt is intentionally left as-is — it's simply ignored (and never
    // shown) while scheduling is off, so there's nothing to reset here.
  } else if (body.scheduleFrequency !== undefined && monitor.schedulingEnabled) {
    patch.scheduleFrequency = body.scheduleFrequency;
    patch.nextRunAt = computeNextRunAt(body.scheduleFrequency);
  }

  const updated = await store.updateMonitor(req.params.id, patch);
  // Same enriched shape as the GET endpoints (derivedStatus, latest-run
  // fields) — returning the bare record here would make the frontend's
  // status badge revert to "pending" after every settings save.
  const summary = await buildMonitorSummary(store, updated);
  res.json({ monitor: summary });
});

// DELETE /api/monitors/:id — removes the monitor and everything tied to it
// (runs, snapshots, changes, agent logs, stored screenshots/HTML). Irreversible.
router.delete("/monitors/:id", async (req, res) => {
  const monitor = await getOwnedMonitor(req.userId, req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });
  await store.deleteMonitor(req.params.id);
  res.status(204).send();
});

router.get("/monitors/:id/history", async (req, res) => {
  const monitor = await getOwnedMonitor(req.userId, req.params.id);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });
  const snapshots = await store.listSnapshotsForMonitor(req.params.id);
  const runs = await store.listRunsForMonitor(req.params.id);

  // A short "most important change" preview per run, so the History timeline
  // can show *what* happened without the caller re-fetching every run's
  // full change list separately.
  const runsWithPreview = await Promise.all(
    runs.map(async (run) => {
      if (run.status === "failed" || run.reportType !== "comparison" || run.meaningfulChangeCount === 0) {
        return { ...run, topChanges: [] as string[], topSignificance: null };
      }
      const changes = await store.getChanges(run.id);
      const preview = buildChangePreview(changes.filter((c) => c.meaningful));
      return { ...run, topChanges: preview.lines, topSignificance: preview.topSignificance };
    }),
  );

  res.json({
    snapshots: snapshots.map((s) => ({
      id: s.id, runId: s.runId, versionNumber: s.versionNumber,
      capturedAt: s.snapshot.metadata.capturedAt, isSuccessful: s.isSuccessful,
    })),
    runs: runsWithPreview,
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
      userId, url, normalizedUrl: normalized, schedulingEnabled: false, scheduleFrequency: "6h",
    });
  }

  const result = await triggerRun(userId, monitor.id, "manual");
  if ("error" in result) return res.status(429).json({ error: result.error });
  res.status(202).json({ runId: result.run.id, monitorId: monitor.id, alreadyMonitored });
});

router.get("/runs/:id", async (req, res) => {
  let run = await store.getRun(req.params.id);
  if (!run || run.userId !== req.userId) return res.status(404).json({ error: "Run not found" });
  run = await reconcileStaleRun(run);
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

// GET /api/runs/:id/baseline-summary — "what we captured" for a baseline report (reportType === "baseline").
router.get("/runs/:id/baseline-summary", async (req, res) => {
  const run = await store.getRun(req.params.id);
  if (!run || run.userId !== req.userId) return res.status(404).json({ error: "Run not found" });
  if (!run.currentSnapshotId) return res.status(404).json({ error: "No snapshot available for this run" });

  const snapshot = await store.getSnapshot(run.currentSnapshotId);
  if (!snapshot) return res.status(404).json({ error: "Snapshot not found" });

  const summary = buildBaselineSummary(snapshot.snapshot);
  const screenshotUrl = await store.getScreenshotUrl(snapshot.id).catch(() => undefined);
  res.json({ ...summary, screenshotUrl });
});

// GET /api/runs/:id/screenshot-url — short-lived viewable URL for this run's captured page preview.
router.get("/runs/:id/screenshot-url", async (req, res) => {
  const run = await store.getRun(req.params.id);
  if (!run || run.userId !== req.userId) return res.status(404).json({ error: "Run not found" });
  if (!run.currentSnapshotId) return res.status(404).json({ error: "No snapshot available for this run" });

  const url = await store.getScreenshotUrl(run.currentSnapshotId).catch(() => undefined);
  if (!url) return res.status(404).json({ error: "No screenshot was captured for this run" });
  res.json({ url });
});

router.get("/runs/:id/logs", async (req, res) => {
  const run = await store.getRun(req.params.id);
  if (!run || run.userId !== req.userId) return res.status(404).json({ error: "Run not found" });
  const logs = await store.getLogs(req.params.id);
  res.json({ logs });
});

// GET /api/runs/:id/report.pdf — downloadable PDF of the change report (§23-ish: a shareable artifact, not just an on-screen view).
router.get("/runs/:id/report.pdf", async (req, res) => {
  const run = await store.getRun(req.params.id);
  if (!run || run.userId !== req.userId) return res.status(404).json({ error: "Run not found" });
  const monitor = await store.getMonitor(run.monitorId);
  if (!monitor) return res.status(404).json({ error: "Monitor not found" });

  const changes = await store.getChanges(req.params.id);
  const meaningful = changes.filter((c) => c.meaningful).sort((a, b) => rank(b.significance) - rank(a.significance));
  const cosmetic = changes.filter((c) => !c.meaningful);

  try {
    const html = buildReportHtml(monitor, run, meaningful, cosmetic);
    const pdf = await renderHtmlToPdf(html);
    const filenameSafeTitle = (monitor.title || "report").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="changescope-${filenameSafeTitle}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error("[api] PDF generation failed:", err);
    res.status(500).json({ error: "Could not generate the PDF report." });
  }
});

router.get("/analytics", async (req, res) => {
  const summary = await buildAnalytics(store, req.userId);
  res.json(summary);
});

function rank(sig: "high" | "medium" | "low"): number {
  return sig === "high" ? 2 : sig === "medium" ? 1 : 0;
}

export default router;
