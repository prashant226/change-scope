/**
 * Supabase-backed StorageAdapter (§65-66). Maps the camelCase domain records
 * used throughout the app to the snake_case schema in supabase/migrations,
 * and uploads raw evidence (screenshot, HTML) to Storage instead of holding
 * it in memory. Uses the service-role key — this file only ever runs
 * server-side (see storage/index.ts), never in the browser (§67).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AgentLogEntry } from "../types/run.js";
import type { AnalyzedChange } from "../types/change.js";
import type { PageSnapshot } from "../types/snapshot.js";
import type { MonitorRecord, RunRecord, SnapshotRecord, StorageAdapter } from "./types.js";

const SCREENSHOTS_BUCKET = "screenshots";
const RAW_HTML_BUCKET = "raw-html";

export class SupabaseStore implements StorageAdapter {
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // ---- monitored_urls ----------------------------------------------------

  async findMonitorByNormalizedUrl(userId: string, normalizedUrl: string) {
    const { data, error } = await this.client
      .from("monitored_urls")
      .select("*")
      .eq("user_id", userId)
      .eq("normalized_url", normalizedUrl)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToMonitor(data) : undefined;
  }

  async createMonitor(input: Omit<MonitorRecord, "id" | "createdAt" | "updatedAt">) {
    const { data, error } = await this.client
      .from("monitored_urls")
      .insert({
        user_id: input.userId,
        url: input.url,
        normalized_url: input.normalizedUrl,
        title: input.title,
        status: input.status,
        schedule_frequency: input.scheduleFrequency,
        next_run_at: input.nextRunAt,
        last_run_at: input.lastRunAt,
        last_successful_snapshot_id: input.lastSuccessfulSnapshotId,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToMonitor(data);
  }

  async getMonitor(id: string) {
    const { data, error } = await this.client.from("monitored_urls").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToMonitor(data) : undefined;
  }

  async listMonitors(userId: string) {
    const { data, error } = await this.client
      .from("monitored_urls")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToMonitor);
  }

  async updateMonitor(id: string, patch: Partial<MonitorRecord>) {
    const { data, error } = await this.client
      .from("monitored_urls")
      .update({
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.scheduleFrequency !== undefined && { schedule_frequency: patch.scheduleFrequency }),
        ...(patch.nextRunAt !== undefined && { next_run_at: patch.nextRunAt }),
        ...(patch.lastRunAt !== undefined && { last_run_at: patch.lastRunAt }),
        ...(patch.lastSuccessfulSnapshotId !== undefined && { last_successful_snapshot_id: patch.lastSuccessfulSnapshotId }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return rowToMonitor(data);
  }

  async listDueMonitors(nowIso: string) {
    const { data, error } = await this.client
      .from("monitored_urls")
      .select("*")
      .eq("status", "active")
      .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`);
    if (error) throw error;
    return (data || []).map(rowToMonitor);
  }

  async deleteMonitor(id: string) {
    // Storage objects live outside Postgres, so they aren't covered by the
    // FK cascades below — clean them up first (best-effort: a stray file
    // left behind is harmless clutter, not a correctness problem, so a
    // failure here doesn't block deleting the actual records).
    await Promise.all([
      this.removeStorageFolder(SCREENSHOTS_BUCKET, id),
      this.removeStorageFolder(RAW_HTML_BUCKET, id),
    ]).catch((err) => console.error(`[storage] Failed to clean up storage for monitor ${id}:`, err));

    // runs -> snapshots/changes/agent_logs all cascade from monitored_urls
    // via ON DELETE CASCADE (see supabase/migrations/0001_init.sql) — one
    // delete here is enough.
    const { error } = await this.client.from("monitored_urls").delete().eq("id", id);
    if (error) throw error;
  }

  private async removeStorageFolder(bucket: string, monitorId: string): Promise<void> {
    const { data: files, error: listError } = await this.client.storage.from(bucket).list(monitorId);
    if (listError || !files || files.length === 0) return;
    const paths = files.map((f) => `${monitorId}/${f.name}`);
    const { error: removeError } = await this.client.storage.from(bucket).remove(paths);
    if (removeError) throw removeError;
  }

  // ---- runs ----------------------------------------------------------------

  async createRun(input: Omit<RunRecord, "id" | "startedAt">) {
    const { data, error } = await this.client
      .from("runs")
      .insert({
        monitor_id: input.monitorId,
        user_id: input.userId,
        status: input.status,
        trigger_type: input.triggerType,
        report_type: input.reportType,
        previous_snapshot_id: input.previousSnapshotId,
        current_snapshot_id: input.currentSnapshotId,
        completed_at: input.completedAt,
        error_code: input.error?.code,
        error_message: input.error?.message,
        meaningful_change_count: input.meaningfulChangeCount,
        cosmetic_change_count: input.cosmeticChangeCount,
        ai_status: input.aiStatus,
        capture_status: input.captureStatus,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToRun(data);
  }

  async updateRun(id: string, patch: Partial<RunRecord>) {
    const { data, error } = await this.client
      .from("runs")
      .update({
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.reportType !== undefined && { report_type: patch.reportType }),
        ...(patch.previousSnapshotId !== undefined && { previous_snapshot_id: patch.previousSnapshotId }),
        ...(patch.currentSnapshotId !== undefined && { current_snapshot_id: patch.currentSnapshotId }),
        ...(patch.completedAt !== undefined && { completed_at: patch.completedAt }),
        ...(patch.error !== undefined && { error_code: patch.error?.code, error_message: patch.error?.message }),
        ...(patch.meaningfulChangeCount !== undefined && { meaningful_change_count: patch.meaningfulChangeCount }),
        ...(patch.cosmeticChangeCount !== undefined && { cosmetic_change_count: patch.cosmeticChangeCount }),
        ...(patch.aiStatus !== undefined && { ai_status: patch.aiStatus }),
        ...(patch.captureStatus !== undefined && { capture_status: patch.captureStatus }),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return rowToRun(data);
  }

  async getRun(id: string) {
    const { data, error } = await this.client.from("runs").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToRun(data) : undefined;
  }

  async listRunsForMonitor(monitorId: string) {
    const { data, error } = await this.client
      .from("runs")
      .select("*")
      .eq("monitor_id", monitorId)
      .order("started_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToRun);
  }

  // ---- agent_logs ------------------------------------------------------

  async appendLog(runId: string, entry: AgentLogEntry) {
    const { error } = await this.client.from("agent_logs").insert({
      run_id: runId,
      sequence: entry.sequence,
      timestamp: entry.timestamp,
      stage: entry.stage,
      action: entry.action,
      reason: entry.reason,
      status: entry.status,
      metadata: entry.metadata,
    });
    if (error) throw error;
  }

  async getLogs(runId: string) {
    const { data, error } = await this.client
      .from("agent_logs")
      .select("*")
      .eq("run_id", runId)
      .order("sequence", { ascending: true });
    if (error) throw error;
    return (data || []).map(
      (row): AgentLogEntry => ({
        sequence: row.sequence,
        timestamp: row.timestamp,
        stage: row.stage,
        action: row.action,
        reason: row.reason,
        status: row.status,
        metadata: row.metadata ?? undefined,
      }),
    );
  }

  // ---- snapshots (+ raw evidence in Storage) ----------------------------

  async saveSnapshot(input: Omit<SnapshotRecord, "id" | "createdAt">) {
    let screenshotPath: string | undefined;
    let rawHtmlPath: string | undefined;

    if (input.screenshotBuffer) {
      screenshotPath = `${input.monitorId}/${input.runId}.png`;
      const { error } = await this.client.storage
        .from(SCREENSHOTS_BUCKET)
        .upload(screenshotPath, input.screenshotBuffer, { contentType: "image/png", upsert: true });
      if (error) throw error;
    }
    if (input.rawHtml) {
      rawHtmlPath = `${input.monitorId}/${input.runId}.html`;
      const { error } = await this.client.storage
        .from(RAW_HTML_BUCKET)
        .upload(rawHtmlPath, input.rawHtml, { contentType: "text/html", upsert: true });
      if (error) throw error;
    }

    const { data, error } = await this.client
      .from("snapshots")
      .insert({
        monitor_id: input.monitorId,
        run_id: input.runId,
        version_number: input.versionNumber,
        original_url: input.snapshot.metadata.url,
        final_url: input.snapshot.metadata.finalUrl,
        title: input.snapshot.metadata.title,
        capture_status: input.snapshot.metadata.status,
        snapshot_data: input.snapshot,
        content_hash: input.contentHash,
        raw_html_path: rawHtmlPath,
        screenshot_path: screenshotPath,
        captured_at: input.snapshot.metadata.capturedAt,
        is_successful: input.isSuccessful,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToSnapshot(data);
  }

  async getLastSuccessfulSnapshot(monitorId: string) {
    const { data, error } = await this.client
      .from("snapshots")
      .select("*")
      .eq("monitor_id", monitorId)
      .eq("is_successful", true)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToSnapshot(data) : undefined;
  }

  async getSnapshot(id: string) {
    const { data, error } = await this.client.from("snapshots").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToSnapshot(data) : undefined;
  }

  async listSnapshotsForMonitor(monitorId: string) {
    const { data, error } = await this.client
      .from("snapshots")
      .select("*")
      .eq("monitor_id", monitorId)
      .order("version_number", { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToSnapshot);
  }

  async getScreenshotUrl(snapshotId: string) {
    const { data, error } = await this.client
      .from("snapshots")
      .select("screenshot_path")
      .eq("id", snapshotId)
      .maybeSingle();
    if (error || !data?.screenshot_path) return undefined;

    const { data: signed, error: signError } = await this.client.storage
      .from(SCREENSHOTS_BUCKET)
      .createSignedUrl(data.screenshot_path, 60 * 10); // 10 minutes — just long enough to view, not a durable link
    if (signError) return undefined;
    return signed?.signedUrl;
  }

  // ---- changes -----------------------------------------------------------

  async saveChanges(runId: string, changes: AnalyzedChange[]) {
    if (changes.length === 0) return;
    const { error } = await this.client.from("changes").insert(
      changes.map((c) => ({
        run_id: runId,
        group_key: c.groupKey,
        group_title: c.groupTitle,
        section: c.section,
        element_label: c.elementLabel,
        change_type: c.changeType,
        classification: c.classification,
        before_value: c.beforeValue,
        after_value: c.afterValue,
        meaningful: c.meaningful,
        significance: c.significance,
        what_changed: c.whatChanged,
        why_it_matters: c.whyItMatters,
        confidence: c.confidence,
        needs_review: c.needsReview,
        evidence: c.evidence,
      })),
    );
    if (error) throw error;
  }

  async getChanges(runId: string) {
    const { data, error } = await this.client.from("changes").select("*").eq("run_id", runId);
    if (error) throw error;
    return (data || []).map(
      (row): AnalyzedChange => ({
        groupKey: row.group_key,
        groupTitle: row.group_title,
        section: row.section ?? undefined,
        elementLabel: row.element_label ?? undefined,
        changeType: row.change_type,
        classification: row.classification,
        beforeValue: row.before_value ?? undefined,
        afterValue: row.after_value ?? undefined,
        meaningful: row.meaningful,
        significance: row.significance,
        whatChanged: row.what_changed ?? "",
        whyItMatters: row.why_it_matters ?? "",
        confidence: row.confidence ?? 0,
        needsReview: row.needs_review ?? false,
        evidence: row.evidence ?? undefined,
      }),
    );
  }
}

// ---- row <-> record mapping -------------------------------------------

function rowToMonitor(row: any): MonitorRecord {
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    normalizedUrl: row.normalized_url,
    title: row.title ?? undefined,
    status: row.status,
    scheduleFrequency: row.schedule_frequency,
    nextRunAt: row.next_run_at ?? undefined,
    lastRunAt: row.last_run_at ?? undefined,
    lastSuccessfulSnapshotId: row.last_successful_snapshot_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRun(row: any): RunRecord {
  return {
    id: row.id,
    monitorId: row.monitor_id,
    userId: row.user_id,
    status: row.status,
    triggerType: row.trigger_type,
    reportType: row.report_type ?? undefined,
    previousSnapshotId: row.previous_snapshot_id ?? undefined,
    currentSnapshotId: row.current_snapshot_id ?? undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    error: row.error_code ? { code: row.error_code, message: row.error_message } : undefined,
    meaningfulChangeCount: row.meaningful_change_count,
    cosmeticChangeCount: row.cosmetic_change_count,
    aiStatus: row.ai_status,
    captureStatus: row.capture_status,
  };
}

function rowToSnapshot(row: any): SnapshotRecord {
  return {
    id: row.id,
    monitorId: row.monitor_id,
    runId: row.run_id,
    versionNumber: row.version_number,
    snapshot: row.snapshot_data as PageSnapshot,
    contentHash: row.content_hash,
    isSuccessful: row.is_successful,
    createdAt: row.created_at,
    // screenshotBuffer/rawHtml are intentionally not re-downloaded here — nothing
    // reads them back today (no visual-preview UI yet). Their Storage paths are
    // on the row (raw_html_path/screenshot_path) if a future feature needs them.
  };
}
