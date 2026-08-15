/**
 * Shared entry point for starting a run — used by both the manual "Run now"
 * API routes and the scheduler (§63: "a scheduled run should use exactly the
 * same orchestrator as a manual run — only the trigger differs").
 */
import { getStore } from "../storage/index.js";
import { canStartRun, markRunStarted, markRunFinished } from "../api/rateLimit.js";
import { executeRun } from "./runOrchestrator.js";
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
  const latest = recentRuns[0];
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
  executeRun(run.id)
    .catch((err) => console.error("[trigger] executeRun crashed:", err))
    .finally(() => markRunFinished(userId));

  return { run };
}
