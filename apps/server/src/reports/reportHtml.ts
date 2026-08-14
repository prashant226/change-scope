/**
 * Builds a self-contained HTML report — printed to PDF via Playwright
 * (reports/renderPdf.ts). Deliberately plain inline CSS only; this is never
 * shipped to a browser as a page, just rendered headlessly. Mirrors the web
 * report's structure exactly: summary header, then Section · Impact /
 * What changed / Before / Now / Why it might matter per meaningful group.
 */
import type { AnalyzedChange } from "../types/change.js";
import type { MonitorRecord, RunRecord } from "../storage/types.js";
import { groupByKey } from "./groupAnalyzedChanges.js";

const IMPACT_STYLES: Record<AnalyzedChange["significance"], { label: string; color: string }> = {
  high: { label: "High Impact", color: "#DC2626" },
  medium: { label: "Medium Impact", color: "#D97706" },
  low: { label: "Low Impact", color: "#16A34A" },
};

function esc(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function renderGroup(group: AnalyzedChange[]): string {
  const first = group[0];
  const impact = IMPACT_STYLES[first.significance];
  const rows = group
    .map(
      (c) => `
      <div style="display:flex; gap:24px; margin-bottom:10px;">
        <div style="flex:1;">
          ${group.length > 1 ? `<p style="font-size:11px;color:#64748B;margin:0 0 2px;">${esc(c.elementLabel)}</p>` : ""}
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.04em;color:#64748B;margin:0 0 2px;">Before</p>
          <p style="font-size:13px;color:#111827;margin:0;">${esc(c.beforeValue) || "—"}</p>
        </div>
        <div style="flex:1;">
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.04em;color:#2563EB;margin:0 0 2px;">Now</p>
          <p style="font-size:13px;color:#111827;font-weight:600;margin:0;">${esc(c.afterValue) || "—"}</p>
        </div>
      </div>`,
    )
    .join("");

  return `
    <article style="border:1px solid #E5E7EB; border-radius:8px; padding:16px; margin-bottom:12px; page-break-inside:avoid;">
      <div style="margin-bottom:10px;">
        <span style="font-size:15px; font-weight:600; color:#111827;">${esc(first.groupTitle)}</span>
        <span style="font-size:14px; color:#64748B;"> · </span>
        <span style="font-size:14px; font-weight:600; color:${impact.color};">${impact.label}</span>
        ${first.needsReview ? `<span style="font-size:10px; font-weight:600; color:#64748B; border:1px solid #E5E7EB; border-radius:4px; padding:1px 6px; margin-left:8px;">Needs review</span>` : ""}
      </div>
      <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.04em;color:#64748B;margin:0 0 3px;">What changed</p>
      <p style="font-size:13px;color:#111827;margin:0 0 12px;">${esc(first.whatChanged)}</p>
      ${rows}
      <div style="background:#F8FAFC; border-radius:6px; padding:10px 12px; margin-top:8px;">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.04em;color:#64748B;margin:0 0 4px;">Why it might be significant</p>
        <p style="font-size:13px;color:#111827;margin:0;">${esc(first.whyItMatters)}</p>
      </div>
    </article>`;
}

export function buildReportHtml(
  monitor: MonitorRecord,
  run: RunRecord,
  meaningful: AnalyzedChange[],
  cosmetic: AnalyzedChange[],
): string {
  const groups = groupByKey(meaningful);
  const isBaseline = !run.previousSnapshotId;

  const impactCounts: Record<AnalyzedChange["significance"], number> = { high: 0, medium: 0, low: 0 };
  for (const g of groups) impactCounts[g[0].significance]++;
  const impactSummary = (["high", "medium", "low"] as const)
    .filter((sig) => impactCounts[sig] > 0)
    .map((sig) => `${impactCounts[sig]} ${IMPACT_STYLES[sig].label}`)
    .join(" · ");

  const summaryHtml = isBaseline
    ? ""
    : `<div style="margin-bottom:20px;">
         <h2 style="font-size:17px; color:#111827; margin:0 0 4px;">${groups.length} meaningful change${groups.length === 1 ? "" : "s"} detected</h2>
         ${impactSummary ? `<p style="font-size:12px; color:#64748B; margin:0 0 2px;">${esc(impactSummary)}</p>` : ""}
         ${cosmetic.length > 0 ? `<p style="font-size:12px; color:#64748B; margin:0;">${cosmetic.length} cosmetic change${cosmetic.length === 1 ? "" : "s"} excluded</p>` : ""}
       </div>`;

  const body = isBaseline
    ? `<div style="border:1px solid #E5E7EB; border-radius:8px; padding:20px;">
         <h2 style="font-size:16px; color:#111827; margin:0 0 6px;">✓ Baseline created</h2>
         <p style="font-size:13px; color:#64748B; margin:0;">This was the first captured snapshot — no comparison was available yet.</p>
       </div>`
    : groups.length === 0
      ? `<div style="border:1px solid #E5E7EB; border-radius:8px; padding:20px;">
           <h2 style="font-size:16px; color:#111827; margin:0 0 6px;">✓ No meaningful changes detected</h2>
           <p style="font-size:13px; color:#64748B; margin:0;">This page was materially unchanged since the previous snapshot.</p>
         </div>`
      : groups.map(renderGroup).join("");

  const cosmeticHtml =
    cosmetic.length > 0
      ? `<h2 style="font-size:14px; color:#111827; margin:24px 0 10px;">Other detected changes (${cosmetic.length})</h2>
         ${cosmetic
           .map(
             (c) => `
           <div style="border:1px solid #E5E7EB; border-radius:6px; padding:10px 12px; margin-bottom:8px;">
             <p style="font-size:12px; color:#111827; margin:0 0 2px;">${esc(c.elementLabel || c.groupTitle)}: ${esc(c.beforeValue)} → ${esc(c.afterValue)}</p>
             <p style="font-size:11px; color:#64748B; margin:0;">Classification: ${esc(c.classification)}. ${esc(c.whyItMatters)}</p>
           </div>`,
           )
           .join("")}`
      : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 32px; color: #111827; }
</style>
</head>
<body>
  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
    <span style="font-size:13px; font-weight:600; color:#2563EB;">ChangeScope</span>
    <span style="font-size:11px; color:#64748B;">Generated ${formatDate(new Date().toISOString())}</span>
  </div>
  <h1 style="font-size:20px; margin:12px 0 2px;">${esc(monitor.title) || esc(monitor.url)}</h1>
  <p style="font-size:12px; color:#64748B; margin:0 0 4px; word-break:break-all;">${esc(monitor.url)}</p>
  <p style="font-size:12px; color:#64748B; margin:0 0 20px;">
    Snapshot captured ${formatDate(run.completedAt || run.startedAt)} · ${esc(run.triggerType)} run
  </p>

  ${summaryHtml}
  ${body}
  ${cosmeticHtml}

  <p style="font-size:10px; color:#94A3B8; margin-top:32px; border-top:1px solid #E5E7EB; padding-top:12px;">
    Deterministic facts were detected by ChangeScope's diff engine; significance interpretation was
    generated by AI and should be read as a hint, not a guarantee.
  </p>
</body>
</html>`;
}
