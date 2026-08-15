/**
 * Shared entry point for starting a run — used by both the manual "Run now"
 * API routes and the scheduler (§63: "a scheduled run should use exactly the
 * same orchestrator as a manual run — only the trigger differs").
 */
import { getStore } from "../storage/index.js";
import { canStartRun, markRunStarted, markRunFinished } from "../api/rateLimit.js";
import { executeRun } from "./runOrchestrator.js";
import { reconcileStaleRun } from "./reconcileStaleRun.js";
import type { RunRecord } from "../storage/types.js";

const store = getStore();

export async function triggerRun(
  userId: string,
  monitorId: string,
  triggerType: "manual" | "scheduled",
): Promise<{ run: RunRecord } | { error: string }> {
  // Single entry point for both manual and scheduled runs, so this guard
  // covers every combination (manual-vs-manual, scheduled-vs-scheduled,
  // manual-vs-scheduled) without each caller needing its own check (§29).
  const recentRuns = await store.listRunsForMonitor(monitorId);
  const latest = recentRuns[0] ? await reconcileStaleRun(recentRuns[0]) : undefined;
  if (latest && (latest.status === "queued" || latest.status === "running")) {
    return { error: "A scan is already running for this monitor." };
  }

  const gate = canStartRun(userId, monitorId);
  if (!gate.ok) return { error: gate.reason || "Could not start run." };

  const run = await store.createRun({
    monitorId,
    userId,
    status: "queued",
    triggerType,
    meaningfulChangeCount: 0,
    cosmeticChangeCount: 0,
    aiStatus: "pending",
    captureStatus: "pending",
  });

  markRunStarted(userId, monitorId);
  // Fire-and-forget: callers get the run id back immediately (§70).
  const runPromise = executeRun(run.id)
    .catch((err) => console.error("[trigger] executeRun crashed:", err))
    .finally(() => markRunFinished(userId));

  // On a long-running host this detached promise just keeps executing in
  // the background. A Vercel serverless function has no persistent process
  // backing it, though — without this, the platform can freeze/terminate
  // the function once the HTTP response is sent, killing the run mid-flight
  // (observed live: runs got stuck at "running" forever). waitUntil() tells
  // Vercel to keep the invocation alive until the promise settles, up to
  // vercel.json's maxDuration. No-op (and unimported) everywhere else.
  if (process.env.VERCEL) {
    const { waitUntil } = await import("@vercel/functions");
    waitUntil(runPromise);
  }

  return { run };
}
