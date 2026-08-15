# ChangeScope — AI Web Change Intelligence

ChangeScope watches a webpage, remembers what it looked like last time, and tells you — in plain
language — what actually changed and why it might matter. It is not a diff viewer: it separates
real content/functional changes from CSS noise, collapses DOM-level noise into logical business
events, and uses an LLM only to reason about *significance*, never to discover facts.

> **Status: feature-complete, extensively QA-hardened.** URL → capture → snapshot → deterministic
> diff → semantic reasoning → AI significance → report works end to end, with Monitors / Monitor
> Detail / History / Analytics pages, real Supabase persistence, real Supabase Auth, a live
> scheduler, PDF export, and a unified real-time execution view. The deterministic pipeline has
> been through seven rounds of controlled-fixture QA (duplicate-fact consolidation, parent/child
> suppression, section reordering, semantic continuity across page redesigns, functional-vs-visual
> classification) — see [Diff & reasoning pipeline](#diff--reasoning-pipeline) for what each stage
> is specifically hardened against. See [Known limitations](#known-limitations) for what's left.

## Table of contents

- [Product](#product)
- [Architecture](#architecture)
- [Diff & reasoning pipeline](#diff--reasoning-pipeline)
- [ShopKart significance knowledge base](#shopkart-significance-knowledge-base)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Setup](#setup)
- [Scheduler](#scheduler)
- [Testing](#testing)
- [Reliability & code-quality practices](#reliability--code-quality-practices)
- [Usage walkthrough](#usage-walkthrough)
- [Known limitations](#known-limitations)
- [Why these choices](#why-these-choices)

## Product

An employee wants to monitor a webpage — a product page, a pricing page, a careers page — and be
told when something meaningful changes, without reading a wall of raw diff output. Example:

```
Pricing · High Impact
What changed
The listed price decreased from ₹49,999 to ₹44,999 and the displayed discount increased
from 17% to 25%.
Why it might be significant
A lower price combined with a higher advertised discount may materially improve the
product's purchase proposition.
```

The demo/QA target is a fictional e-commerce page, but the agent has **no page-specific logic
anywhere in the pipeline** — the snapshot schema, diff engine, and semantic reasoning are fully
generic and are exercised against real, unrelated public pages (ShopKart-style fixtures, Flipkart,
Blinkit, ClickPost, InvoiceFlow AI, and others) as part of normal verification.

Non-negotiable product principles, enforced throughout the codebase:

- **Deterministic-first, AI-second.** Code decides *what* changed; the LLM only judges *whether it
  matters* and *why*. The LLM never invents a fact it can't see in the evidence it was given.
- **Never send a full page to the LLM.** Only compact, already-grouped candidate events — see
  [token efficiency](#diff--reasoning-pipeline).
- **A failed capture never overwrites the last good baseline.** The previous successful snapshot
  stays authoritative until a new capture succeeds.
- **Cosmetic ≠ meaningful.** CSS/formatting-only changes are classified `visual` and excluded from
  the meaningful count and default report, never silently inflating "N changes detected."
- **The meaningful count is logical groups, not raw DOM diffs.** A price + its discount changing
  together is one event, not two; a section's three product cards disappearing because their
  parent section was removed is one event, not four.
- **Monitor status and scheduler state are separate concepts.** "Pending / Running / Completed /
  Failed" describes the latest scan; "automatic checks on/off" is configured independently and
  never implied by run status.

## Architecture

```
User pastes a URL
      │
      ▼
POST /api/runs ──► create/find monitor ──► create run row ──► respond with runId (fire-and-forget)
                                                    │
                                                    ▼
                                          orchestrator.executeRun()
                                                    │
      ┌─────────────────────────────────────────────┴───────────────────────────────────────┐
      │ validating_url → finding_previous_snapshot → opening_page/rendering/capturing       │
      │   → building_snapshot → saving_snapshot → comparing → classifying → grouping        │
      │   → ai_reasoning → building_report → completed/failed/partial                       │
      │ (every stage appends an agent_log row with real metrics; the frontend polls         │
      │  /runs/:id + /runs/:id/logs and renders them as one unified Agent Activity stream — │
      │  live while the run executes, the same stream afterward in the historical report)   │
      └─────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                        ┌───────────────────────────┼────────────────────────────┐
                        ▼                           ▼                            ▼
                 Playwright capture         Deterministic diff +          OpenAI GPT-5 mini
                 (browser/capture.ts,       semantic pipeline             (ai/reason.ts —
                 extractPage.ts) → generic  (diff/, classifier/ —         judges meaningfulness,
                 PageSnapshot (snapshot/)   see next section)             significance, and writes
                                                                          one grounded sentence per
                                                                          change group; falls back
                                                                          to facts-only on failure)
```

**Core principle:** deterministic code discovers *what* changed and reduces it to compact logical
events; the LLM only judges *whether it matters* and *why*. See `apps/server/src/diff`,
`classifier`, and `ai` for the exact boundary.

## Diff & reasoning pipeline

This is the part of the system that's been iterated on the most, across seven rounds of controlled
QA. The full stage list, in order (`diff/engine.ts` → `classifier/*` → `ai/reason.ts`):

```
Raw Snapshot (Playwright + extractPage.ts)
      ↓
Stable Element/Section Identity  (matchElements.ts — text, then href, then fingerprint,
                                   then local-sibling-index; never raw DOM position)
      ↓
Raw Diff  (classify.ts — one element pair can independently produce a functional event
           AND a visual event; neither ever silently hides the other)
      ↓
Structural Collapse  (structuralCollapse.ts — a section whose children were wholesale
                       removed/replaced becomes ONE event, not N)
      ↓
Structural Hierarchy Analysis  (structuralHierarchy.ts — reconstructs which sections are
                                 nested under which from heading levels; a child section's
                                 removal is suppressed when its parent section was also
                                 removed in the same comparison, kept only as evidence)
      ↓
Semantic Identity Resolution  (semanticContinuity.ts — a renamed/reparented section
                                ["Key Highlights" → "Key Benefits"] is recognized as the
                                SAME section that moved, by comparing its element
                                fingerprints, never its heading text)
      ↓
Section Reorder Detection  (sectionOrder.ts — same sections, new relative order, reported
                             as one "Page Structure" event, never remove+add)
      ↓
Semantic Fact Extraction  (semanticFacts.ts — decomposes one element expressing two facts
                            at once ["4.4/5 from 2,436 reviews"], then consolidates the SAME
                            fact appearing in two DOM locations into one)
      ↓
Classification + Partition  (partition.ts — visual/metadata split off here; they never
                              reach the LLM, never inflate the meaningful count)
      ↓
Fact-Type-Aware Grouping  (factType.ts + group.ts — a generic/headingless section mixing
                            price + availability + spec values splits into one group per
                            fact kind, instead of all being mislabeled "Pricing")
      ↓
AI Significance Reasoning  (ai/reason.ts — compact candidate groups only, strict JSON
                             schema, grounding rules against fabrication/overclaiming)
      ↓
Report
```

Each stage exists because a specific, generic failure mode was found and fixed against controlled
before/after page fixtures — not patched for one specific site. What each stage is proven against
(via `apps/server/tests-unit/`, 142 tests total):

| Failure mode | Fixed by | Test coverage |
|---|---|---|
| Same fact reported twice (e.g. a review count appearing near the title *and* in a summary sentence) | `semanticFacts.ts` | `semanticFacts.test.ts` |
| One element expressing two facts at once ("4.4 / 5 from 2,436 reviews") | `semanticFacts.ts` (compound decomposition) | `semanticFacts.test.ts` |
| A page's own title used as a section name instead of the real nearby heading | `inferSectionTitle.ts` | `inferSectionTitle.test.ts` |
| A removed section's children reported as N separate removals | `structuralCollapse.ts` (same-section case) + `structuralHierarchy.ts` (nested-sibling-section case) | `structuralCollapse.test.ts`, `structuralHierarchy.test.ts` |
| A whole-page reorder producing dozens of remove/add pairs instead of one reorder event | `sectionOrder.ts` | `sectionOrder.test.ts` |
| A renamed/reparented section (redesign) read as "removed" + "added" instead of "moved" | `semanticContinuity.ts` | `semanticContinuity.test.ts`, `cartnestV6.test.ts` |
| A generic/headingless section with mixed facts (price + availability + spec) all mislabeled "Pricing" | `factType.ts` | `factType.test.ts` |
| A link whose `href` changed (visible label unchanged) read as "removed" | `matchElements.ts` (text-first identity) | `matchElements.test.ts` |
| Meaningful text buried inside a non-captured wrapper tag silently dropped | `extractPage.ts` (leaf-text fallback) | live-verified (browser-only code, no unit harness) |
| A button whose label *and* color changed at once — only one ever reported | `classify.ts` (multi-event return) | `classify.test.ts` |
| Duplicate Before/Now evidence blocks in a report | `ChangeCard.tsx` / `reportHtml.ts` dedup | `reportEvidenceDedup.test.ts` |
| Meaningful copy changes (policy/positioning wording) wrongly excluded as "minor wording" | `ai/reason.ts` system-prompt grounding rules | `aiFallback.test.ts` + prompt-level rules (LLM judgment isn't unit-testable) |

**Token efficiency:** the LLM receives the already-grouped candidate list (a handful of logical
events), never the raw DOM diff — see `ai/buildContext.ts`, which also enforces a hard character
budget (`AI_CONTEXT_TOKEN_BUDGET`) so one pathological page can't blow the context window.

**Debug observability:** set `DEBUG_DIFF=1` to log every raw change (entity, section, changeType,
classification, before/after, suppressedBy) to the server console during a run — never exposed via
the API or UI, purely a development aid (`diff/debugDiff.ts`).

## ShopKart significance knowledge base

A small, deterministic, keyword-matched knowledge base (`ai/shopkartKb.ts` + `ai/shopkartContext.ts`)
that enriches *significance reasoning only* — never fact detection — and only for the one
fictional demo page it's scoped to (`isShopkartPage()` gates every use of it). It supplies:

- Grounded guidance sentences per fact type (pricing, promotional dates, specifications,
  availability) that the LLM may use to phrase "why it might matter," with explicit constraints
  ("never infer the business reason for a price change," "never claim actual hardware changed").
- A ShopKart-only cross-section grouping step (`mergeShopkartRelatedGroups`) that combines
  availability+CTA, price+discount, and promotion+dates into single events specific to this demo's
  page layout.

Evidence priority is strict and enforced in the system prompt: current page evidence outranks the
KB every time, and constraints are hard limits, never suggestions. This is a controlled-demo
enrichment layer, not a claim about real ShopKart business behavior, and it never runs for any
other monitored page.

## Tech stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Lucide icons + Recharts (Analytics)
- **Backend:** Node.js + TypeScript + Express
- **Browser automation:** Playwright (Chromium), SSRF-protected (`browser/urlSafety.ts` blocks
  private IPs, loopback, cloud metadata endpoints, non-http(s) schemes)
- **AI:** OpenAI Responses API, GPT-5 mini, strict JSON-schema output validated with Zod
- **Diff/semantic reasoning:** custom deterministic TypeScript — see [above](#diff--reasoning-pipeline); no LLM involved anywhere in this layer
- **Database/Storage:** Supabase Postgres + Storage (optional — falls back to an in-memory store
  when not configured; see [Setup](#setup))
- **Auth:** Supabase Auth (email/password) — optional, same fallback as above
- **Scheduler:** node-cron, checking once a minute for due monitors
- **PDF export:** Playwright-rendered HTML → PDF (`reports/reportHtml.ts` + `renderPdf.ts`)

No Redis, no queues, no vector DB — see `docs/supabase-storage-todo.md` for what's intentionally
deferred.

## Project structure

```
apps/
  web/                         React frontend (Vite)
    src/
      pages/                   Overview, Monitors, MonitorDetail, History, Analytics,
                                Login/Signup/ForgotPassword/ResetPassword
      components/
        AgentActivity.tsx      Single unified real-time execution view (live during a run,
                                the same stream in the historical report — no separate
                                "trail" vs "technical trace" components)
        BaselineReport.tsx     First-run "what we captured" report (no comparison to make yet)
        ChangeCard.tsx         One rendered change-report card (Section · Impact / What
                                changed / Before / Now / Why it might matter), with
                                duplicate-evidence dedup
        ScanTimeline.tsx       History page's per-monitor scan list
        SnapshotTimeline.tsx   Monitor Detail's own History tab (kept deliberately separate
                                from ScanTimeline — different page, different scope)
        MonitorActionsMenu.tsx History page's compact "..." monitor actions menu
        CreateMonitorModal.tsx URL + check-frequency in one step, with existing-URL
                                detection (never creates a duplicate monitor)
        ConfirmDialog.tsx, Toast.tsx, InfoTooltip.tsx, StatusBadge.tsx, ...
      hooks/useRun.ts           Polls a run to completion (Realtime-ready swap point)
      lib/                      api.ts (typed fetch client), format.ts, downloadPdf.ts
  server/                      Express backend
    src/
      browser/                 capture.ts (Playwright), extractPage.ts (in-page DOM
                                extraction, serialized via page.evaluate), urlSafety.ts (SSRF)
      snapshot/                build.ts (raw extraction → generic PageSnapshot),
                                fingerprint.ts (stable cross-snapshot identity), normalize.ts
      diff/                    engine.ts (orchestrates the pipeline below) + one module per
                                stage: matchElements.ts, classify* (see classifier/),
                                structuralCollapse.ts, structuralHierarchy.ts,
                                semanticContinuity.ts, sectionOrder.ts, debugDiff.ts
      classifier/               classify.ts, partition.ts, semanticFacts.ts, factType.ts,
                                group.ts, inferSectionTitle.ts, buildCosmeticChanges.ts
      ai/                      reason.ts (OpenAI call + grounding rules), schema.ts (Zod),
                                buildContext.ts (compact candidate payload),
                                shopkartKb.ts / shopkartContext.ts
      orchestrator/            runOrchestrator.ts (the stage machine + agent_log emission),
                                trigger.ts (shared entry point for manual + scheduled runs,
                                with the concurrency guard — see Reliability below)
      reports/                 monitorSummary.ts (derived status), analytics.ts,
                                buildBaselineSummary.ts, buildChangePreview.ts,
                                countGroups.ts (logical-group counting, not raw rows),
                                determineReportType.ts, reportHtml.ts + renderPdf.ts
      scheduler/index.ts        node-cron tick — see Scheduler below
      storage/                 StorageAdapter interface + MemoryStore/SupabaseStore
      api/                     routes.ts, authMiddleware.ts, rateLimit.ts
      types/, utils/           shared types, config.ts (env-driven guardrails), schedule.ts
    tests-unit/                142 Vitest tests — see Testing below
supabase/
  migrations/                  0001-0006, applied in order — see Setup
  seed/                        storage bucket setup
docs/                          architecture notes, deferred-work TODOs
```

## Data model

Five tables (`supabase/migrations/0001_init.sql` onward), all scoped to `user_id` with FK cascades
so deleting a monitor atomically removes everything under it in one transaction:

```
monitored_urls  (the monitor itself: url, scheduling_enabled, schedule_frequency,
                  next_run_at, last_run_at, last_successful_snapshot_id)
      │  on delete cascade
      ▼
runs            (one row per scan: trigger_type manual/scheduled, status, report_type
                  baseline/comparison, meaningful/cosmetic counts, ai_status, capture_status)
      │  on delete cascade
      ├──► snapshots    (versioned page captures — full generic PageSnapshot JSON,
      │                  screenshot + raw HTML paths in Storage)
      ├──► changes      (AI-enriched logical change groups: classification, significance,
      │                  what/why, confidence, evidence)
      └──► agent_logs   (the Agent Activity stream — one row per pipeline stage, with
                         real metrics as JSON metadata: durations, element counts, raw
                         diff counts, AI token estimates)
```

`ScheduleFrequency` is an explicit six-value enum (`30m | 1h | 2h | 6h | 12h | 24h`) chosen at
monitor-creation time or changed later from Monitor → Settings — never inferred, never silently
enabled. See `apps/server/src/storage/types.ts` for the full `StorageAdapter` interface both
`MemoryStore` and `SupabaseStore` implement identically.

## Setup

### Prerequisites
- Node.js 18+
- An OpenAI API key (optional — the app runs and shows deterministic results without one)
- A Supabase project (optional — falls back to an in-memory store that doesn't survive a restart)

### Install

```bash
npm install
npx playwright install chromium --with-deps   # from apps/server, or run once at repo root
```

### Supabase setup (optional but recommended)

1. Create a free project at [supabase.com](https://supabase.com) → **New Project**.
2. In **Project Settings → API**, copy the **Project URL**, **anon public** key, and
   **service_role** key (click "Reveal").
3. In the **SQL Editor**, run every migration in `supabase/migrations/` **in order** —
   `0001_init.sql` through `0006_expand_schedule_frequency.sql` — then `supabase/seed/storage_buckets.sql`.
   Each migration is additive/idempotent (`if not exists` / `if exists` guards); running an
   already-applied one again is a no-op.
4. Put the three keys into `apps/server/.env` (see below) **and** the URL + anon key into
   `apps/web/.env` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (safe to expose client-side —
   see `apps/web/.env.example`).

Without this, the app runs on an in-memory store with no login — fine for a quick local demo, but
monitors/runs are lost on every server restart and there's no user isolation.

### Environment variables

```bash
cp .env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

**Server** (`apps/server/.env`):

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Enables AI significance reasoning. Without it, runs still work — the UI shows "AI significance analysis is temporarily unavailable" and deterministic facts still display (`aiStatus: "unavailable"`, run still completes as `"partial"`). |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Enables persistent storage (Postgres + Storage buckets) via `SupabaseStore`, **and** enables real auth enforcement on every API route. Without these, the server uses an in-memory store and a single fixed demo user id instead — no persistence, no login required. |
| `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` | Optional — run `npm run seed:demo-user --workspace apps/server` to create a pre-confirmed demo account via the Supabase Admin API (password must be 8+ characters). Otherwise, just sign up through the app's Signup page. |
| `PORT`, `FRONTEND_URL` | Server port and CORS origin. |
| `MAX_BROWSER_CONCURRENCY`, `MAX_RUNS_PER_USER`, `RUN_COOLDOWN_SECONDS`, `AI_CONTEXT_TOKEN_BUDGET`, `PAGE_CAPTURE_TIMEOUT_MS`, `MAX_SCROLL_DURATION_MS`, `MAX_SCROLL_STEPS`, `AI_RETRY_COUNT`, `AI_RETRY_DELAY_MS` | Performance guardrails, all overridable — see `apps/server/src/utils/config.ts`. |
| `DEBUG_DIFF` | Set to `1` for verbose per-stage diff debug logging to the server console during development — see [Diff & reasoning pipeline](#diff--reasoning-pipeline). Never exposed to the API/UI. |

**Web** (`apps/web/.env`):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Needed for the Login/Signup/Forgot-password screens to talk to Supabase Auth directly. Without these, auth screens will show a console warning and fail to sign in. |

### Run locally

```bash
# terminal 1
npm run dev:server   # http://localhost:4000

# terminal 2
npm run dev:web      # http://localhost:5173 (proxies /api to :4000)
```

Open http://localhost:5173. If Supabase is configured, you'll land on the Login screen. See
[Usage walkthrough](#usage-walkthrough) for what to do next.

### Build

```bash
npm run build:server   # tsc -p apps/server/tsconfig.build.json
npm run build:web      # tsc -b && vite build
```

## Scheduler

A `node-cron` job checks once a minute for monitors with `scheduling_enabled = true` whose
`next_run_at` has arrived, and triggers a run through the **exact same orchestrator** a manual
"Run now" uses — only `trigger_type` differs (`"scheduled"` vs `"manual"`). Deliberately separate
from monitor status: creating a monitor never implicitly turns scheduling on, and a monitor's
"Pending / Running / Completed / Failed" status is always derived fresh from its latest run,
never conflated with whether automatic checks are enabled.

`next_run_at` is computed from the chosen frequency (30 min / 1 hr / 2 hr / 6 hr / 12 hr / 24 hr —
configurable at monitor-creation time or later from Monitor → Settings) and only advances when
`schedulingEnabled` is true — a manually-run or scheduling-disabled monitor never has its
`next_run_at` touched. A crashed run still reschedules rather than getting retried every minute.
A per-tick batch cap (`MAX_BROWSER_CONCURRENCY`) avoids spiking browser concurrency if many
monitors come due at once; the rest are picked up next tick. Runs automatically the moment the
server is up — no separate process to start.

**Concurrency guard:** `orchestrator/trigger.ts` is the single entry point for both manual and
scheduled runs, and refuses to start a second run for a monitor that already has one
queued/running — covering manual-vs-manual, scheduled-vs-scheduled, and manual-vs-scheduled
collisions from one place, returning `"A scan is already running for this monitor."` rather than
racing a duplicate capture.

## Testing

```bash
npm run test:unit --workspace apps/server
```

**142 unit tests** across 27 files, entirely offline (no live network/API calls — the AI layer is
tested via its deterministic no-API-key fallback path). Coverage by area:

- **Diff engine core** (`diff.test.ts`): numeric/text/structural/functional/visual/media changes,
  duplicate non-identifying hrefs (`href="#"`), unchanged-element suppression.
- **Semantic pipeline** (see the [failure-mode table above](#diff--reasoning-pipeline) for the
  full mapping): `semanticFacts.test.ts`, `structuralCollapse.test.ts`, `structuralHierarchy.test.ts`,
  `semanticContinuity.test.ts`, `sectionOrder.test.ts`, `factType.test.ts`, `inferSectionTitle.test.ts`,
  `matchElements.test.ts`, `classify.test.ts`.
- **Full-scenario regression replays**: `reportPipeline.test.ts`, `cartnestV3.test.ts`,
  `cartnestV6.test.ts` — offline `diffSnapshots → partition → group` replays of real controlled
  before/after fixtures, run on every change to catch regressions across QA rounds.
- **Security**: `urlSafety.test.ts` — blocked schemes, localhost, loopback, private IP ranges,
  cloud metadata IP.
- **AI layer**: `aiFallback.test.ts` — schema validation, no-API-key fallback, empty-group
  short-circuit, grounding-rule adherence in the deterministic fallback path.
- **Storage/orchestration**: `deleteMonitor.test.ts` (cascade correctness), `monitorSummary.test.ts`
  (derived status independent of scheduling state), `triggerConcurrency.test.ts`, `schedule.test.ts`
  (next-run-at math per frequency), `determineReportType.test.ts`, `countGroups.test.ts`.
- **Report building**: `buildChangePreview.test.ts`, `buildBaselineSummary.test.ts`,
  `buildCosmeticChanges.test.ts`, `reportEvidenceDedup.test.ts`, `partition.test.ts`,
  `shopkartContext.test.ts`.

There is no frontend unit-test suite (`apps/web` has no `test` script) — frontend changes are
verified live against the running app with Playwright-driven screenshots as part of normal
development, not via a committed test harness.

## Reliability & code-quality practices

- **Deterministic-first pipeline** (above) means the vast majority of report-quality bugs are
  fixable and testable in plain TypeScript, without needing to re-prompt an LLM and hope.
- **Ownership checks everywhere.** Every monitor/run-scoped route resolves the record and checks
  `record.userId === req.userId`, returning 404 (never 403) on mismatch so a client can't even
  confirm another user's monitor ID exists.
- **Atomic, cascading deletion.** Deleting a monitor is a single `DELETE` against `monitored_urls`;
  every dependent row (runs, snapshots, changes, agent_logs) cascades via FK constraints in the
  same transaction — never "monitor deleted but snapshots remain." Storage objects (screenshots,
  raw HTML) are cleaned up best-effort alongside.
- **A failed capture never becomes the new baseline.** `runOrchestrator.ts` only advances
  `last_successful_snapshot_id` on a genuinely successful capture.
- **Server crash isolation.** Every Express route is wrapped so a rejected promise in a handler
  becomes a normal 500 response instead of an unhandled-rejection process crash (Express 4 doesn't
  catch async handler rejections on its own) — plus a global `unhandledRejection` listener as
  defense in depth.
- **SSRF protection** on every capture: scheme allowlist, DNS-resolved private/loopback/link-local/
  cloud-metadata IP blocking, applied before Playwright ever navigates.
- **Rate limiting / cooldown** per user and per monitor (`api/rateLimit.ts`), independent of the
  scheduler's own per-tick concurrency cap.
- **Grounded AI, enforced by prompt contract, not just hoped for:** the system prompt explicitly
  forbids inventing causes, requires hedged ("may," "could") language for interpretation, forbids
  claiming a physical/real-world fact from advertised copy, and requires citing only what's in the
  evidence it was given — see `ai/reason.ts`'s `SYSTEM_INSTRUCTIONS`.
- **Confidence handled internally.** Low-confidence AI verdicts surface as "Needs review" in the
  UI rather than exposing a raw decimal the user has no way to calibrate.

## Usage walkthrough

1. **Sign in** (or use the seeded demo account — see [Demo auth](#demo-auth) below).
2. **Add a monitor** from the Monitors page (or paste a URL directly on Overview for a one-off
   run). The Add Monitor modal asks for the URL and, in the same step, how often to check it
   (30 min – 24 hr) — or leave scheduling off and run it manually whenever you like. Adding an
   already-monitored URL never creates a duplicate; it offers to update that monitor's schedule
   instead.
3. **First run = baseline.** With nothing to compare against yet, you get a "what we captured"
   report — page overview, structure, stats, a screenshot preview — never a fake "no changes"
   comparison.
4. **Every run after that = a comparison report**, whether or not anything meaningful changed.
   Watch it live: **Agent Activity** shows the real pipeline executing stage by stage, with actual
   metrics (element counts, raw diff counts, AI token estimates) — the same stream is preserved
   afterward when you open that run from History.
5. **History** lists every scan for a monitor as a human-readable timeline (baseline vs.
   comparison, outcome, top changes, manual vs. scheduled) with a compact "..." menu for
   deleting a monitor entirely (confirmed, then atomically removed — see
   [Reliability](#reliability--code-quality-practices)).
6. **Analytics** aggregates meaningful changes across all monitors — by type, by impact, by
   monitor — with a tooltip on every metric explaining what it measures.
7. **Download PDF** on any comparison report for a shareable artifact matching the on-screen
   report exactly.

### Demo auth

Real Supabase Auth — email/password, with Login/Signup/Forgot-password/Reset-password screens.
For a quick demo login without going through signup:

```bash
# with DEMO_USER_EMAIL / DEMO_USER_PASSWORD set in apps/server/.env
npm run seed:demo-user --workspace apps/server
```

This creates a pre-confirmed account via the Supabase Admin API (or resets its password if it
already exists) — no email confirmation step needed. Never commit a real password for this; it's
meant for local/demo use only.

If Supabase isn't configured at all, the API falls back to one fixed demo user id and skips auth
entirely, so the core flow can still be exercised with zero setup.

## Known limitations

- **Realtime updates** — the frontend polls `/api/runs/:id` every ~1.2s rather than subscribing to
  Supabase Realtime. Polling is an explicitly acceptable fallback path in the original design spec,
  and it's what's actually implemented; swapping in Realtime is a drop-in change at `hooks/useRun.ts`
  without touching anything else.
- **No frontend unit-test suite** — see [Testing](#testing). Frontend correctness is verified live
  (Playwright screenshots against the running app) during development rather than via committed
  tests.
- **`extractPage.ts` has no unit-test harness** — it's a function serialized into a live browser
  page via Playwright's `page.evaluate`, not something plain Node/Vitest can exercise directly.
  Its behavior is verified live (real headless-browser runs against controlled HTML fixtures)
  rather than in the committed suite.
- **Section hierarchy relies on real heading tags.** `structuralHierarchy.ts` reconstructs
  parent/child section relationships from `<h1>`–`<h6>` levels. A page that uses non-heading
  markup (e.g. styled `<div>`s) for what a human would read as subsection titles won't have that
  relationship inferred — this is an inherent limit of a heading-based signal, not a gap in the
  suppression logic itself.

None of these affect the core agentic loop (capture → snapshot → deterministic semantic pipeline →
AI reasoning → report) or the Overview/Monitors/Monitor Detail/History/Analytics screens, which are
fully working, generic, and live-verified against a real Supabase project.

## Why these choices

- **Deterministic diff + LLM reasoning, not "send the page to GPT":** raw HTML diffing is noisy
  and non-generic; blind LLM diffing is slow, expensive, and prone to inventing causes. Splitting
  "what changed" (code) from "why it might matter" (LLM) keeps the system fast, cheap, and
  explainable — and testable: the failure-mode table above is only possible because almost the
  entire reasoning pipeline is plain TypeScript with unit tests, not prompt engineering.
- **A multi-stage semantic pipeline instead of one big diff pass:** each stage (structural
  collapse, hierarchy suppression, semantic continuity, fact-type grouping) targets one specific,
  generic class of over-reporting or misclassification found through controlled QA — kept as
  separate, independently-testable modules rather than one large function, so fixing one class of
  bug can't silently regress another.
- **Playwright:** the target page must be observed as rendered — JS-heavy pages, lazy content, and
  consent overlays need a real browser, not a raw HTTP fetch.
- **Supabase:** one hosted Postgres + Storage + Auth service covers the whole persistence surface
  without adding Redis/queues/a second database. FK cascades do the deletion-integrity work that
  would otherwise need a manual transaction.
- **GPT-5 mini via the Responses API with strict JSON schema:** cheap enough for one call per run,
  structured output means free-form text is never trusted as fact, and the compact
  already-grouped payload (never raw DOM) keeps token usage — and the chance of the model
  hallucinating from noise — low.
