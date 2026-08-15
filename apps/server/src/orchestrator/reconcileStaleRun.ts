import { getStore } from "../storage/index.js";
import { config } from "../utils/config.js";
import type { RunRecord } from "../storage/types.js";

const store = getStore();

/**
 * A run stuck at "queued"/"running" past config.staleRunTimeoutMs almost
 * certainly isn't actually still running — see the config docblock for why
 * this can happen despite executeRun()'s own error handling. Called on read
 * (GET /runs/:id) and before the "already running" concurrency check
 * (orchestrator/trigger.ts) so a stale row self-heals instead of silently
 * blocking every future run for that monitor forever.
 */
export async function reconcileStaleRun(run: RunRecord): Promise<RunRecord> {
  if (run.status !== "queued" && run.status !== "running") return run;

  const ageMs = Date.now() - new Date(run.startedAt).getTime();
  if (ageMs < config.staleRunTimeoutMs) return run;

  const updated = await store.updateRun(run.id, {
    status: "failed",
    captureStatus: "failed",
    error: {
      code: "timeout",
      message: "This run took too long and was stopped before it could finish.",
    },
    completedAt: new Date().toISOString(),
  });
  return updated ?? run;
}
