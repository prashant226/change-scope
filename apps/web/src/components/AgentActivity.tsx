import { useEffect, useState } from "react";
import type { AgentLogEntry, RunRecord } from "../types/api";

/**
 * The single execution-transparency surface — replaces what used to be two
 * separate components (a human-readable "Agent Trail" and a technical "Live
 * Execution Trace"). One event stream, one timeline: each entry leads with
 * plain language (what happened, why) and carries a compact technical line
 * as secondary detail, exactly as it does in the real backend log — nothing
 * here is simulated or animated independently of that log.
 */

const STAGE_LABELS: Record<string, string> = {
  received: "Orchestrator",
  validating_url: "Orchestrator",
  finding_previous_snapshot: "Orchestrator",
  opening_page: "Playwright",
  rendering: "Playwright",
  capturing: "Playwright",
  building_snapshot: "Snapshot",
  saving_snapshot: "Snapshot",
  comparing: "Diff engine",
  classifying: "Classifier",
  grouping: "Grouping",
  ai_reasoning: "AI reasoner",
  building_report: "Report builder",
  completed: "Orchestrator",
  failed: "Orchestrator",
};

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour12: false });
}

/**
 * Turns real metadata into the terse "22 raw differences · 114ms" style
 * technical line from the spec — per-stage, because each stage's metadata
 * shape is different. Only ever renders values that are actually present;
 * a stage with no metadata simply shows no technical line.
 */
function compactDetail(entry: AgentLogEntry): string[] {
  const m = (entry.metadata || {}) as Record<string, unknown>;
  const num = (k: string) => (typeof m[k] === "number" ? (m[k] as number) : undefined);
  const str = (k: string) => (typeof m[k] === "string" ? (m[k] as string) : undefined);
  const dur = num("durationMs");
  const lines: string[] = [];

  switch (entry.stage) {
    case "opening_page": {
      const url = str("url");
      if (url) lines.push(`Playwright · ${url}`);
      break;
    }
    case "rendering": {
      const finalUrl = str("finalUrl");
      const title = str("pageTitle");
      if (finalUrl) lines.push(`Final URL: ${finalUrl}`);
      if (title) lines.push(`Page title: ${title}`);
      break;
    }
    case "finding_previous_snapshot": {
      // "Using version N as the baseline" is already the human reason text — technical line is just timing.
      break;
    }
    case "building_snapshot": {
      const sections = num("sections");
      const content = num("contentElements");
      const interactive = num("interactiveElements");
      const media = num("media");
      if (sections !== undefined || content !== undefined) lines.push(`${sections ?? 0} sections · ${content ?? 0} content elements`);
      if (interactive !== undefined || media !== undefined) lines.push(`${interactive ?? 0} interactive · ${media ?? 0} media`);
      break;
    }
    case "saving_snapshot": {
      const v = num("versionNumber");
      if (v !== undefined) lines.push(dur !== undefined ? `Version ${v} · ${formatDuration(dur)}` : `Version ${v}`);
      break;
    }
    case "comparing": {
      const raw = num("rawDifferences");
      if (raw !== undefined) lines.push(dur !== undefined ? `${raw} raw difference${raw === 1 ? "" : "s"} · ${formatDuration(dur)}` : `${raw} raw difference${raw === 1 ? "" : "s"}`);
      break;
    }
    case "classifying": {
      const parts = Object.entries(m)
        .filter(([k, v]) => k !== "durationMs" && typeof v === "number" && v > 0)
        .map(([k, v]) => `${v} ${k}`);
      if (parts.length > 0) lines.push(parts.join(" · "));
      break;
    }
    case "grouping": {
      const groups = num("candidateGroups");
      const cosmetic = num("cosmeticExcluded");
      if (groups !== undefined) lines.push(`${groups} candidate group${groups === 1 ? "" : "s"} · ${cosmetic ?? 0} cosmetic excluded`);
      break;
    }
    case "ai_reasoning": {
      const model = str("model");
      const groups = num("groupsSubmitted");
      const tokens = num("contextTokensApprox");
      if (entry.status === "in_progress") {
        if (model) lines.push(`${model} · ${groups ?? 0} group${groups === 1 ? "" : "s"}`);
      } else {
        const bits: string[] = [];
        if (dur !== undefined) bits.push(formatDuration(dur));
        if (tokens !== undefined) bits.push(`~${tokens.toLocaleString()} input tokens`);
        if (bits.length > 0) lines.push(bits.join(" · "));
      }
      break;
    }
    case "building_report": {
      const meaningful = num("meaningfulChanges");
      const cosmetic = num("cosmeticChanges");
      if (meaningful !== undefined) lines.push(`${meaningful} meaningful · ${cosmetic ?? 0} cosmetic excluded`);
      break;
    }
    default:
      break;
  }

  // A bare duration badge for stages with no stage-specific line of their own.
  if (lines.length === 0 && dur !== undefined && entry.stage !== "finding_previous_snapshot") {
    lines.push(formatDuration(dur));
  } else if (entry.stage === "finding_previous_snapshot" && dur !== undefined) {
    lines.push(formatDuration(dur));
  }

  return lines;
}

/** A colored status dot — the same visual language as the monitor/scan status badges elsewhere in the app, instead of mismatched checkmark glyphs. */
function StatusDot({ status, spinning }: { status: AgentLogEntry["status"]; spinning: boolean }) {
  const color = status === "failed" ? "bg-high" : spinning ? "bg-primary animate-pulse" : "bg-low";
  // block, not the span default of inline — width/height are no-ops on inline elements.
  return <span className={`block h-2 w-2 rounded-full shrink-0 ${color}`} aria-hidden />;
}

function useElapsed(startedAt: string | undefined, live: boolean): string {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [live]);
  if (!startedAt) return "0.0s";
  return formatDuration(Date.now() - new Date(startedAt).getTime());
}

/** "Scheduled scan" / "Manual scan" — secondary context on how this run started (§25, §27). */
function TriggerTag({ run }: { run?: RunRecord }) {
  if (!run) return null;
  return <span className="text-xs text-muted">· {run.triggerType === "scheduled" ? "Scheduled scan" : "Manual scan"}</span>;
}

/** Compact header summary — running elapsed time, or a finished/failed completion line. */
function ActivityHeader({ run, logs, live }: { run?: RunRecord; logs: AgentLogEntry[]; live: boolean }) {
  const elapsed = useElapsed(run?.startedAt ?? logs[0]?.timestamp, live);

  if (live) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-ink">Agent Activity</h2>
        <span className="text-xs text-muted">Running · {elapsed}</span>
        <TriggerTag run={run} />
      </div>
    );
  }

  if (run?.status === "failed") {
    const durationMs = run.completedAt ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime() : undefined;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="h-2 w-2 rounded-full bg-high shrink-0" aria-hidden />
        <h2 className="text-sm font-semibold text-high">Run failed</h2>
        {durationMs !== undefined && <span className="text-xs text-muted">{formatDuration(durationMs)}</span>}
        <TriggerTag run={run} />
      </div>
    );
  }

  const durationMs = run?.completedAt ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime() : undefined;
  const showCounts = run?.reportType === "comparison";
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="h-2 w-2 rounded-full bg-low shrink-0" aria-hidden />
      <h2 className="text-sm font-semibold text-ink">Analysis complete</h2>
      {durationMs !== undefined && <span className="text-xs text-muted">{formatDuration(durationMs)}</span>}
      <TriggerTag run={run} />
      {showCounts && (
        <span className="text-xs text-muted">
          · {run!.meaningfulChangeCount} meaningful change{run!.meaningfulChangeCount === 1 ? "" : "s"} ·{" "}
          {run!.cosmeticChangeCount} cosmetic excluded
        </span>
      )}
    </div>
  );
}

export function AgentActivity({ logs, live, run }: { logs: AgentLogEntry[]; live: boolean; run?: RunRecord }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted">Waiting for the agent to start…</p>;
  }

  return (
    <div>
      <div className="mb-4" title="A real-time record of what the agent did during this scan, including why each step was taken.">
        <ActivityHeader run={run} logs={logs} live={live} />
      </div>
      <div className="space-y-3" role="log" aria-live={live ? "polite" : "off"} aria-label="Agent activity">
        {logs.map((entry, i) => {
          const isCurrentStep = live && i === logs.length - 1 && entry.status === "in_progress";
          const detail = compactDetail(entry);
          return (
            <div key={entry.sequence} className="flex gap-3">
              <div className="pt-1.5">
                <StatusDot status={entry.status} spinning={isCurrentStep} />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-[10px] text-muted">{formatClock(entry.timestamp)}</span>
                  <p className="text-sm font-medium text-ink">{entry.action}</p>
                  <span className="text-[10px] font-mono text-muted uppercase tracking-wide">{STAGE_LABELS[entry.stage] || entry.stage}</span>
                </div>
                <p className="text-sm text-muted">{entry.reason}</p>
                {detail.map((line, li) => (
                  <p key={li} className="text-xs font-mono text-muted/80 mt-0.5">{line}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
