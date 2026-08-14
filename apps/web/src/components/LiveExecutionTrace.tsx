import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, TerminalSquare } from "lucide-react";
import type { AgentLogEntry } from "../types/api";

/**
 * Technical companion to the Agent Trail. Same real backend events, a
 * different audience: "what is actually happening under the hood?" instead
 * of "what is the agent doing and why?". Every line here comes straight
 * from AgentLogEntry.metadata — real measured values the orchestrator
 * recorded, never a simulated/animated log. If a stage didn't run (e.g. AI
 * reasoning on a baseline run), it simply doesn't appear here — the trace
 * always reflects actual execution, not a fixed template of stages.
 */

const STAGE_LABELS: Record<string, string> = {
  received: "ORCHESTRATOR",
  validating_url: "ORCHESTRATOR",
  finding_previous_snapshot: "ORCHESTRATOR",
  opening_page: "PLAYWRIGHT",
  rendering: "PLAYWRIGHT",
  capturing: "PLAYWRIGHT",
  building_snapshot: "SNAPSHOT",
  saving_snapshot: "SNAPSHOT",
  comparing: "DIFF ENGINE",
  classifying: "CLASSIFIER",
  grouping: "GROUPING",
  ai_reasoning: "AI REASONER",
  building_report: "REPORT BUILDER",
  completed: "ORCHESTRATOR",
  failed: "ORCHESTRATOR",
};

// Known metadata keys get a readable label; anything else falls back to a
// generic camelCase → "Camel case" formatter, so new metadata fields never
// silently disappear from the trace.
const KNOWN_LABELS: Record<string, string> = {
  url: "URL",
  finalUrl: "Final URL",
  pageTitle: "Page title",
  previousVersion: "Previous version",
  errorCode: "Error code",
  sections: "Sections",
  contentElements: "Content elements",
  interactiveElements: "Interactive elements",
  media: "Media",
  versionNumber: "Version",
  rawDifferences: "Raw differences",
  content: "Content",
  structural: "Structural",
  functional: "Functional",
  visual: "Visual",
  metadata: "Metadata",
  candidateGroups: "Candidate groups",
  cosmeticExcluded: "Cosmetic excluded",
  model: "Model",
  groupsSubmitted: "Groups submitted",
  contextTokensApprox: "Context (approx.)",
  meaningfulChanges: "Meaningful changes",
  cosmeticChanges: "Cosmetic changes",
  type: "Type",
};

function formatLabel(key: string): string {
  if (KNOWN_LABELS[key]) return KNOWN_LABELS[key];
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (key === "contextTokensApprox" && typeof value === "number") return `~${value.toLocaleString()} tokens`;
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour12: false });
}

function statusDotClass(status: AgentLogEntry["status"]): string {
  if (status === "failed") return "bg-high";
  if (status === "in_progress") return "bg-primary animate-pulse";
  return "bg-low";
}

function TraceEntry({ entry }: { entry: AgentLogEntry }) {
  const meta = entry.metadata || {};
  const { durationMs, ...rest } = meta as Record<string, unknown> & { durationMs?: number };
  const metaEntries = Object.entries(rest).filter(([, v]) => v !== undefined);

  return (
    <div className="border-l-2 border-border pl-3 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDotClass(entry.status)}`} />
          <span className="font-mono text-[10px] text-muted shrink-0">{formatClock(entry.timestamp)}</span>
          <span className="font-mono text-[10px] font-semibold text-primary tracking-wide shrink-0">
            {STAGE_LABELS[entry.stage] || entry.stage.toUpperCase()}
          </span>
        </div>
        {typeof durationMs === "number" && (
          <span className="font-mono text-[10px] text-muted shrink-0">{formatDuration(durationMs)}</span>
        )}
      </div>
      <p className="text-xs text-ink mt-0.5">{entry.action}</p>
      {metaEntries.length > 0 && (
        <dl className="mt-1 space-y-0.5">
          {metaEntries.map(([key, value]) => (
            <div key={key} className="flex gap-1.5 text-[11px] font-mono">
              <dt className="text-muted">{formatLabel(key)}:</dt>
              <dd className="text-ink break-all">{formatValue(key, value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function LiveExecutionTrace({ logs, live }: { logs: AgentLogEntry[]; live: boolean }) {
  const [expanded, setExpanded] = useState(live);
  const wasLive = useState(() => ({ current: live }))[0];

  // Visible by default while a scan is actively running; auto-collapse the
  // moment it finishes so the change report (not this technical view) takes
  // over the screen. Only auto-collapses on the true→false transition, so a
  // user who manually expands it while viewing a finished historical run
  // isn't fought with.
  useEffect(() => {
    if (wasLive.current && !live) setExpanded(false);
    wasLive.current = live;
  }, [live, wasLive]);

  if (logs.length === 0) return null;

  const totalDurationMs = (() => {
    const first = logs[0];
    const last = logs[logs.length - 1];
    if (!first || !last) return null;
    return new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
  })();

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between rounded-lg border border-border bg-soft px-4 py-3 text-left hover:bg-border/40 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm text-ink">
          <TerminalSquare className="h-4 w-4 text-muted" strokeWidth={2} />
          {live ? "Live execution trace running…" : "Execution complete"}
          {!live && totalDurationMs !== null && (
            <span className="text-muted">· {formatDuration(totalDurationMs)}</span>
          )}
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-primary">
          View execution trace <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-soft/60">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <TerminalSquare className="h-4 w-4 text-muted" strokeWidth={2} />
            Live Execution Trace
          </h3>
          <p className="text-xs text-muted mt-0.5">Real-time technical execution of this scan.</p>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink shrink-0"
        >
          Hide <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-4 py-3 max-h-[420px] overflow-y-auto space-y-0.5">
        {logs.map((entry) => (
          <TraceEntry key={entry.sequence} entry={entry} />
        ))}
      </div>
    </div>
  );
}
