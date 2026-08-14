/**
 * The orchestrator — coordinates one agent run end to end (§37). Each stage is
 * explicit, produces an agent log entry, and can fail independently. This is
 * intentionally not "one giant function": each stage delegates to its own
 * module (browser/, snapshot/, diff/, classifier/, ai/).
 */
import { createHash } from "node:crypto";
import { capturePage } from "../browser/capture.js";
import { buildSnapshot } from "../snapshot/build.js";
import { diffSnapshots } from "../diff/engine.js";
import { groupChanges } from "../classifier/group.js";
import { partitionChanges } from "../classifier/partition.js";
import { buildCosmeticChanges } from "../classifier/buildCosmeticChanges.js";
import { reasonAboutChanges } from "../ai/reason.js";
import { countGroups } from "../reports/countGroups.js";
import { getStore } from "../storage/index.js";
import type { AgentLogEntry, RunStage } from "../types/run.js";
import { config } from "../utils/config.js";
import { computeNextRunAt } from "../utils/schedule.js";

const store = getStore();

function contentHash(snapshotData: unknown): string {
  return createHash("sha1").update(JSON.stringify(snapshotData)).digest("hex");
}

class RunLogger {
  private sequence = 0;
  constructor(private runId: string) {}

  async log(stage: RunStage, action: string, reason: string, status: AgentLogEntry["status"], metadata?: Record<string, unknown>) {
    const entry: AgentLogEntry = {
      sequence: this.sequence++,
      timestamp: new Date().toISOString(),
      stage,
      action,
      reason,
      status,
      metadata,
    };
    await store.appendLog(this.runId, entry);
    return entry;
  }
}

export async function executeRun(runId: string): Promise<void> {
  const run = await store.getRun(runId);
  if (!run) throw new Error(`Run ${runId} not found`);
  const monitor = await store.getMonitor(run.monitorId);
  if (!monitor) throw new Error(`Monitor ${run.monitorId} not found`);

  const logger = new RunLogger(runId);
  await store.updateRun(runId, { status: "running" });

  try {
    await logger.log("validating_url", "URL validated", "Checking whether the submitted target can be processed.", "completed");

    await logger.log(
      "finding_previous_snapshot",
      "Looking for a previous snapshot",
      "Using the latest successful snapshot as the comparison baseline, if one exists.",
      "in_progress",
    );
    const previousSnapshot = await store.getLastSuccessfulSnapshot(monitor.id);
    await logger.log(
      "finding_previous_snapshot",
      previousSnapshot ? "Previous snapshot found" : "No previous snapshot found",
      previousSnapshot
        ? "Using the latest successful snapshot as the comparison baseline."
        : "This is the first successful run — a baseline will be created instead of a comparison.",
      "completed",
    );

    await logger.log("opening_page", "Opening the page", "Rendering the target URL in an isolated browser context.", "in_progress");
    const capture = await capturePage(monitor.url, {
      timeoutMs: config.pageCaptureTimeoutMs,
      maxScrollDurationMs: config.maxScrollDurationMs,
      maxScrollSteps: config.maxScrollSteps,
    });

    if (!capture.ok) {
      await logger.log("opening_page", "Page capture failed", capture.error.message, "failed");
      await store.updateRun(runId, {
        status: "failed",
        captureStatus: "failed",
        error: capture.error,
        completedAt: new Date().toISOString(),
      });
      await store.updateMonitor(monitor.id, {
        lastRunAt: new Date().toISOString(),
        nextRunAt: computeNextRunAt(monitor.scheduleFrequency),
      });
      return; // Failed capture NEVER becomes the new baseline (§7, §61).
    }
    await logger.log("rendering", "Page rendered", "Waited for meaningful content before capturing.", "completed");
    await logger.log("capturing", "Snapshot captured", "Current webpage state was recorded.", "completed");

    await logger.log("building_snapshot", "Building generic snapshot", "Converting captured page state into the generic snapshot schema.", "in_progress");
    const snapshotData = buildSnapshot(monitor.url, capture);
    await logger.log("building_snapshot", "Snapshot built", `Detected ${snapshotData.stats.sectionCount} sections and ${snapshotData.stats.contentElementCount} content elements.`, "completed");

    await logger.log("saving_snapshot", "Saving snapshot", "Persisting the snapshot as the new most-recent version.", "in_progress");
    const versionNumber = (await store.listSnapshotsForMonitor(monitor.id)).length + 1;
    const savedSnapshot = await store.saveSnapshot({
      monitorId: monitor.id,
      runId,
      versionNumber,
      snapshot: snapshotData,
      contentHash: contentHash(snapshotData),
      screenshotBuffer: capture.screenshotBuffer,
      rawHtml: capture.html,
      isSuccessful: true,
    });
    await logger.log("saving_snapshot", "Snapshot saved", `Stored as version ${versionNumber}.`, "completed");

    await store.updateMonitor(monitor.id, {
      title: monitor.title || snapshotData.metadata.title,
      lastRunAt: new Date().toISOString(),
      lastSuccessfulSnapshotId: savedSnapshot.id,
      nextRunAt: computeNextRunAt(monitor.scheduleFrequency),
    });

    if (!previousSnapshot) {
      await logger.log("completed", "Baseline created", "We captured this page as your starting snapshot. Future runs will compare against it.", "completed");
      await store.updateRun(runId, {
        status: "completed",
        captureStatus: "complete",
        currentSnapshotId: savedSnapshot.id,
        completedAt: new Date().toISOString(),
        aiStatus: "completed",
      });
      return;
    }

    await logger.log("comparing", "Comparing snapshots", "Detecting differences between current and previous page state.", "in_progress");
    const rawChanges = diffSnapshots(previousSnapshot.snapshot, snapshotData);
    await logger.log("comparing", "Comparison complete", `Found ${rawChanges.length} raw difference(s).`, "completed");

    await logger.log(
      "classifying",
      "Changes classified",
      "Separating content, functional, structural, visual and media differences.",
      "completed",
    );

    // CSS-only changes are pulled out here, before grouping — they're not
    // ambiguous, so they never enter AI reasoning or share a group with a
    // real content change from the same section (§9-10).
    const { candidates, cosmetic } = partitionChanges(rawChanges);

    await logger.log("grouping", "Grouping related changes", "Clustering low-level differences into higher-level events by section.", "in_progress");
    const groups = groupChanges(candidates);
    await logger.log("grouping", "Grouping complete", `Formed ${groups.length} change group(s), plus ${cosmetic.length} cosmetic change(s) set aside.`, "completed");

    await logger.log("ai_reasoning", "AI analysis started", "Interpreting ambiguous changes and their potential significance.", "in_progress");
    const reasonResult = await reasonAboutChanges(groups, snapshotData.metadata.title, {
      apiKey: config.openaiApiKey,
      tokenBudget: config.aiContextTokenBudget,
      retryCount: config.aiRetryCount,
      retryDelayMs: config.aiRetryDelayMs,
    });
    await logger.log(
      "ai_reasoning",
      reasonResult.aiUnavailable ? "AI analysis unavailable" : "AI analysis complete",
      reasonResult.aiUnavailable
        ? "The AI significance step failed; showing deterministic facts without interpretation."
        : "Significance and grouping explanations generated for each change.",
      reasonResult.aiUnavailable ? "failed" : "completed",
    );

    await logger.log("building_report", "Report generated", "Converting analyzed changes into the final user-facing report.", "in_progress");
    const allChanges = [...reasonResult.changes, ...buildCosmeticChanges(cosmetic)];
    await store.saveChanges(runId, allChanges);

    const { meaningful: meaningfulCount, cosmetic: cosmeticCount } = countGroups(allChanges);
    await logger.log("building_report", "Report ready", `${meaningfulCount} meaningful change(s), ${cosmeticCount} cosmetic change(s) excluded from the summary.`, "completed");

    await store.updateRun(runId, {
      status: reasonResult.aiUnavailable ? "partial" : "completed",
      captureStatus: "complete",
      previousSnapshotId: previousSnapshot.id,
      currentSnapshotId: savedSnapshot.id,
      meaningfulChangeCount: meaningfulCount,
      cosmeticChangeCount: cosmeticCount,
      aiStatus: reasonResult.aiUnavailable ? "unavailable" : "completed",
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[orchestrator] Run ${runId} crashed:`, err);
    await logger.log("failed", "Run failed", "An unexpected error interrupted this run.", "failed");
    await store.updateRun(runId, {
      status: "failed",
      error: { code: "unknown", message: "An unexpected error interrupted this run." },
      completedAt: new Date().toISOString(),
    });
    // Still reschedule on a crash — otherwise a scheduled monitor would get
    // picked up again on every subsequent scheduler tick instead of backing off.
    await store.updateMonitor(monitor.id, {
      lastRunAt: new Date().toISOString(),
      nextRunAt: computeNextRunAt(monitor.scheduleFrequency),
    });
  }
}
