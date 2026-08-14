/**
 * In-process storage used when Supabase isn't configured yet (§59 — no Redis;
 * this is not a cache, it's a dev-mode stand-in behind the same StorageAdapter
 * interface a Supabase-backed implementation will satisfy). Data does not
 * survive a server restart — fine for local demoing, not for production.
 */
import { randomUUID } from "node:crypto";
import type { AgentLogEntry } from "../types/run.js";
import type { AnalyzedChange } from "../types/change.js";
import type { MonitorRecord, RunRecord, SnapshotRecord, StorageAdapter } from "./types.js";

export class MemoryStore implements StorageAdapter {
  private monitors = new Map<string, MonitorRecord>();
  private runs = new Map<string, RunRecord>();
  private snapshots = new Map<string, SnapshotRecord>();
  private logs = new Map<string, AgentLogEntry[]>();
  private changes = new Map<string, AnalyzedChange[]>();

  async findMonitorByNormalizedUrl(userId: string, normalizedUrl: string) {
    return [...this.monitors.values()].find((m) => m.userId === userId && m.normalizedUrl === normalizedUrl);
  }

  async createMonitor(input: Omit<MonitorRecord, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const record: MonitorRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.monitors.set(record.id, record);
    return record;
  }

  async getMonitor(id: string) {
    return this.monitors.get(id);
  }

  async listMonitors(userId: string) {
    return [...this.monitors.values()].filter((m) => m.userId === userId);
  }

  async updateMonitor(id: string, patch: Partial<MonitorRecord>) {
    const existing = this.monitors.get(id);
    if (!existing) throw new Error(`Monitor ${id} not found`);
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.monitors.set(id, updated);
    return updated;
  }

  async listDueMonitors(nowIso: string) {
    return [...this.monitors.values()].filter(
      (m) => m.status === "active" && (!m.nextRunAt || m.nextRunAt <= nowIso),
    );
  }

  async deleteMonitor(id: string) {
    const runIds = [...this.runs.values()].filter((r) => r.monitorId === id).map((r) => r.id);
    for (const runId of runIds) {
      this.runs.delete(runId);
      this.logs.delete(runId);
      this.changes.delete(runId);
    }
    for (const [snapshotId, snapshot] of this.snapshots) {
      if (snapshot.monitorId === id) this.snapshots.delete(snapshotId);
    }
    this.monitors.delete(id);
  }

  async createRun(input: Omit<RunRecord, "id" | "startedAt">) {
    const record: RunRecord = { ...input, id: randomUUID(), startedAt: new Date().toISOString() };
    this.runs.set(record.id, record);
    this.logs.set(record.id, []);
    return record;
  }

  async updateRun(id: string, patch: Partial<RunRecord>) {
    const existing = this.runs.get(id);
    if (!existing) throw new Error(`Run ${id} not found`);
    const updated = { ...existing, ...patch };
    this.runs.set(id, updated);
    return updated;
  }

  async getRun(id: string) {
    return this.runs.get(id);
  }

  async listRunsForMonitor(monitorId: string) {
    return [...this.runs.values()]
      .filter((r) => r.monitorId === monitorId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async appendLog(runId: string, entry: AgentLogEntry) {
    const list = this.logs.get(runId) || [];
    list.push(entry);
    this.logs.set(runId, list);
  }

  async getLogs(runId: string) {
    return this.logs.get(runId) || [];
  }

  async saveSnapshot(input: Omit<SnapshotRecord, "id" | "createdAt">) {
    const record: SnapshotRecord = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    this.snapshots.set(record.id, record);
    return record;
  }

  async getLastSuccessfulSnapshot(monitorId: string) {
    return [...this.snapshots.values()]
      .filter((s) => s.monitorId === monitorId && s.isSuccessful)
      .sort((a, b) => b.versionNumber - a.versionNumber)[0];
  }

  async getSnapshot(id: string) {
    return this.snapshots.get(id);
  }

  async listSnapshotsForMonitor(monitorId: string) {
    return [...this.snapshots.values()]
      .filter((s) => s.monitorId === monitorId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }

  async saveChanges(runId: string, changes: AnalyzedChange[]) {
    this.changes.set(runId, changes);
  }

  async getChanges(runId: string) {
    return this.changes.get(runId) || [];
  }
}
