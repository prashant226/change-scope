# ChangeScope

AI-powered web change intelligence. ChangeScope watches a webpage, remembers what it looked like
last time, and tells you in plain language what actually changed and why it might matter.

It is not a diff viewer. It separates real content and functional changes from CSS noise,
collapses DOM-level noise into logical business events, and uses an LLM only to judge
significance, never to discover facts.

**Live demo:** https://change-scope.vercel.app
Login: `demo@changescope.dev` / `ChangeScope-Demo-2026!`

## Example output

```
Pricing · High Impact
What changed
The listed price decreased from ₹49,999 to ₹44,999 and the displayed discount increased
from 17% to 25%.
Why it might be significant
A lower price combined with a higher advertised discount may materially improve the
product's purchase proposition.
```

## Table of contents

- [Product principles](#product-principles)
- [Architecture](#architecture)
- [Diff and reasoning pipeline](#diff-and-reasoning-pipeline)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Setup](#setup)
- [Deploying to Vercel](#deploying-to-vercel)
- [Scheduler](#scheduler)
- [Testing](#testing)
- [Reliability](#reliability)
- [Usage](#usage)
- [Known limitations](#known-limitations)

## Product principles

- **Deterministic first, AI second.** Code decides what changed. The LLM only judges whether it
  matters and why. The LLM never invents a fact it wasn't shown.
- **Never send a full page to the LLM.** It only receives a compact, already-grouped list of
  candidate events.
- **A failed capture never overwrites the last good baseline.** The previous successful snapshot
  stays authoritative until a new capture succeeds.
- **Cosmetic is not meaningful.** CSS or formatting-only changes are classified `visual` and
  excluded from the meaningful count.
- **The meaningful count is logical groups, not raw DOM diffs.** A price and its discount changing
  together is one event, not two.
- **Monitor status and scheduler state are separate.** "Pending / Running / Completed / Failed"
  describes the latest scan. "Automatic checks on/off" is configured independently.

There is no page-specific logic anywhere in the pipeline. The snapshot schema, diff engine, and
semantic reasoning are fully generic, and are tested against real, unrelated pages (Flipkart,
Blinkit, ClickPost, and various demo fixtures) as part of normal verification.

## Architecture

```
User pastes a URL
      |
      v
POST /api/runs -> create/find monitor -> create run row -> respond with runId
                                                    |
                                                    v
                                          orchestrator.executeRun()
                                                    |
      +-----------------------------------------------------------------------------------+
      | validating_url -> finding_previous_snapshot -> opening_page/rendering/capturing   |
      |   -> building_snapshot -> saving_snapshot -> comparing -> classifying -> grouping |
      |   -> ai_reasoning -> building_report -> completed/failed/partial                  |
      |                                                                                   |
      | Every stage appends an agent_log row with real metrics. The frontend polls        |
      | /runs/:id and /runs/:id/logs and renders them as one unified Agent Activity       |
      | stream, live while the run executes and preserved afterward in the report.        |
      +-----------------------------------------------------------------------------------+
                                                    |
                        +---------------------------+---------------------------+
                        v                           v                           v
                 Playwright capture         Deterministic diff +          OpenAI GPT-5 mini
                 (browser/capture.ts,       semantic pipeline             judges significance
                 extractPage.ts) builds     (diff/, classifier/,          and writes one
                 a generic PageSnapshot     see next section)             grounded sentence
                                                                           per change group
```

Core principle: deterministic code discovers what changed and reduces it to compact logical
events. The LLM only judges whether it matters and why. See `apps/server/src/diff`,
`classifier`, and `ai` for the exact boundary.

## Diff and reasoning pipeline

The pipeline runs in this order (`diff/engine.ts` then `classifier/*` then `ai/reason.ts`):

1. **Stable identity** (`matchElements.ts`): match elements across snapshots by text, then href,
   then fingerprint, then sibling index. Never by raw DOM position.
2. **Raw diff** (`classify.ts`): one element can independently produce a functional event and a
   visual event. Neither hides the other.
3. **Structural collapse** (`structuralCollapse.ts`): a section whose children were wholesale
   removed or replaced becomes one event, not N.
4. **Structural hierarchy analysis** (`structuralHierarchy.ts`): reconstructs which sections nest
   under which using heading levels, and suppresses a child section's removal when its parent was
   also removed in the same comparison.
5. **Semantic identity resolution** (`semanticContinuity.ts`): a renamed or reparented section
   (e.g. "Key Highlights" to "Key Benefits") is recognized as the same section that moved, by
   comparing element fingerprints rather than heading text.
6. **Section reorder detection** (`sectionOrder.ts`): the same sections in a new order become one
   "Page Structure" event, not a remove-and-add pair.
7. **Semantic fact extraction** (`semanticFacts.ts`): decomposes one element that expresses two
   facts at once (e.g. "4.4/5 from 2,436 reviews"), and consolidates the same fact when it appears
   in two DOM locations.
8. **Classification and partition** (`partition.ts`): visual and metadata changes are split off
   here and never reach the LLM.
9. **Fact-type-aware grouping** (`factType.ts`, `group.ts`): a headingless section mixing price,
   availability, and spec values splits into one group per fact kind instead of one guessed title.
10. **AI significance reasoning** (`ai/reason.ts`): compact candidate groups only, strict JSON
    schema, explicit grounding rules against fabrication.

Each stage exists because a specific, generic failure mode was found and fixed against controlled
before/after fixtures, not patched for one site. Coverage (142 tests, `apps/server/tests-unit/`):

| Failure mode | Fixed by |
|---|---|
| Same fact reported twice | `semanticFacts.ts` |
| One element expressing two facts at once | `semanticFacts.ts` |
| Page title used as a section name instead of the real heading | `inferSectionTitle.ts` |
| A removed section's children reported as N separate removals | `structuralCollapse.ts`, `structuralHierarchy.ts` |
| A whole-page reorder producing dozens of remove/add pairs | `sectionOrder.ts` |
| A renamed or reparented section read as removed and added | `semanticContinuity.ts` |
| Mixed facts in a generic section all mislabeled with one title | `factType.ts` |
| A link whose href changed but label didn't, read as removed | `matchElements.ts` |
| A button whose label and color both changed, only one reported | `classify.ts` |
| Duplicate before/after evidence blocks in a report | `reportEvidenceDedup.test.ts` |

**Token efficiency:** the LLM receives the already-grouped candidate list, never the raw DOM diff.
`ai/buildContext.ts` also enforces a hard character budget (`AI_CONTEXT_TOKEN_BUDGET`).

**Debug logging:** set `DEBUG_DIFF=1` to log every raw change to the server console during a run.
Never exposed via the API or UI.

## Tech stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS, Lucide icons, Recharts
- **Backend:** Node.js, TypeScript, Express
- **Browser automation:** Playwright (Chromium), with SSRF protection in `browser/urlSafety.ts`
- **AI:** OpenAI Responses API, GPT-5 mini, strict JSON schema validated with Zod
- **Diff and semantic reasoning:** custom deterministic TypeScript, no LLM involved
- **Database and storage:** Supabase Postgres and Storage (falls back to an in-memory store if
  not configured)
- **Auth:** Supabase Auth, email and password
- **Scheduler:** node-cron locally, Vercel Cron on the hosted deployment
- **PDF export:** headless Chromium rendering HTML to PDF

No Redis, no queues, no vector database.

## Project structure

```
apps/
  web/                    React frontend (Vite)
    src/
      pages/              Overview, Monitors, MonitorDetail, History, Analytics, auth pages
      components/         AgentActivity, BaselineReport, ChangeCard, ScanTimeline,
                           SnapshotTimeline, MonitorActionsMenu, CreateMonitorModal, etc.
      hooks/useRun.ts      Polls a run to completion
      lib/                 api.ts (typed fetch client), format.ts, downloadPdf.ts
  server/                 Express backend
    src/
      browser/            capture.ts, extractPage.ts, urlSafety.ts, launchChromium.ts
      snapshot/           build.ts, fingerprint.ts, normalize.ts
      diff/               engine.ts and one module per pipeline stage
      classifier/         classify.ts, partition.ts, semanticFacts.ts, factType.ts, group.ts
      ai/                 reason.ts, schema.ts, buildContext.ts, shopkartKb.ts
      orchestrator/       runOrchestrator.ts, trigger.ts, reconcileStaleRun.ts
      reports/            analytics.ts, buildBaselineSummary.ts, reportHtml.ts, renderPdf.ts
      scheduler/index.ts   scheduled-tick logic, shared by local cron and Vercel Cron
      storage/            StorageAdapter interface, MemoryStore, SupabaseStore
      api/                routes.ts, authMiddleware.ts, rateLimit.ts
      app.ts              Express app, shared by the local server and the Vercel function
    api/index.ts          Vercel serverless entrypoint
    tests-unit/           142 Vitest tests
api/index.ts              Root adapter for Vercel's zero-config /api discovery
supabase/
  migrations/             0001 to 0006, applied in order
  seed/                   storage bucket setup
docs/                     architecture notes, deferred-work TODOs
vercel.json               build, rewrites, and cron config for the hosted deployment
```

## Data model

Five tables (`supabase/migrations/`), all scoped to `user_id`, with FK cascades so deleting a
monitor removes everything under it in one transaction:

```
monitored_urls
      | on delete cascade
      v
runs
      | on delete cascade
      +--> snapshots
      +--> changes
      +--> agent_logs
```

`monitored_urls` holds the monitor itself: url, scheduling flag, frequency, next/last run times.
`runs` holds one row per scan: trigger type, status, report type, meaningful/cosmetic counts.
`snapshots` holds versioned page captures. `changes` holds AI-enriched change groups. `agent_logs`
is the Agent Activity stream, one row per pipeline stage.

Schedule frequency is a six-value enum: `30m | 1h | 2h | 6h | 12h | 24h`, chosen at monitor
creation or changed later. It is never inferred and never silently enabled.

## Setup

### Prerequisites

- Node.js 18+
- An OpenAI API key (optional, the app runs without one)
- A Supabase project (optional, falls back to an in-memory store)

### Install

```bash
npm install
npx playwright install chromium --with-deps
```

### Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. In Project Settings, API, copy the Project URL, anon key, and service role key.
3. In the SQL Editor, run every migration in `supabase/migrations/` in order, then
   `supabase/seed/storage_buckets.sql`. Migrations are idempotent.
4. Put the three keys into `apps/server/.env`, and the URL plus anon key into `apps/web/.env` as
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

Without this, the app runs on an in-memory store with no login. Fine for a quick local demo, but
data does not survive a restart.

### Environment variables

```bash
cp .env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

**Server** (`apps/server/.env`):

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Enables AI significance reasoning. Without it, runs still complete with deterministic facts only. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Enables persistent storage and real auth. Without these, the server uses an in-memory store and one fixed demo user. |
| `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` | Optional. Run `npm run seed:demo-user --workspace apps/server` to create a demo account. |
| `PORT`, `FRONTEND_URL` | Server port and CORS origin. |
| `MAX_BROWSER_CONCURRENCY`, `MAX_RUNS_PER_USER`, `RUN_COOLDOWN_SECONDS`, `AI_CONTEXT_TOKEN_BUDGET`, `PAGE_CAPTURE_TIMEOUT_MS`, `MAX_SCROLL_DURATION_MS`, `MAX_SCROLL_STEPS`, `AI_RETRY_COUNT`, `AI_RETRY_DELAY_MS` | Performance guardrails, all overridable. |
| `DEBUG_DIFF` | Set to `1` for verbose diff logging during development. |
| `CRON_SECRET` | Shared secret for the `/api/cron/tick` endpoint on hosted deployments. |
| `STALE_RUN_TIMEOUT_MS` | How long a run can sit at "running" before it's auto-marked failed. Default 120000. |

**Web** (`apps/web/.env`):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Needed for the login and signup screens to talk to Supabase Auth. |

### Run locally

```bash
npm run dev:server   # http://localhost:4000
npm run dev:web      # http://localhost:5173, proxies /api to :4000
```

### Build

```bash
npm run build:server
npm run build:web
```

## Deploying to Vercel

The project deploys as one Vercel project: a static build for `apps/web`, and the Express app as
a single serverless function at `api/index.ts`.

Two things needed real handling beyond a plain deploy:

- **Playwright's browser.** Vercel functions don't ship a browser binary and have no room for
  Playwright's full download. `browser/launchChromium.ts` detects `process.env.VERCEL` and
  launches `@sparticuz/chromium` through `playwright-core` instead, with `LD_LIBRARY_PATH` set to
  the extracted binary's own directory so its bundled shared libraries resolve correctly.
- **Background runs.** A scan is triggered and the run id is returned immediately while the scan
  keeps working in the background. On a normal server that just works. On Vercel, the platform
  can freeze the function once the response is sent. `orchestrator/trigger.ts` wraps the
  background promise in `@vercel/functions`' `waitUntil()` so the invocation stays alive until the
  run finishes, bounded by `vercel.json`'s `maxDuration`.

If a run is still killed mid-flight (a hard platform timeout bypasses application code entirely),
`orchestrator/reconcileStaleRun.ts` auto-marks it failed the next time it's read or the next time
a new run is requested for that monitor, so a stuck row never blocks future scans.

Vercel's Hobby plan caps cron schedules at once a day, so `vercel.json`'s cron runs daily rather
than at each monitor's configured frequency. Manual "Run now" is unaffected. A Pro plan removes
this limit and raises the function duration cap.

## Scheduler

`scheduler/index.ts` checks for monitors whose `next_run_at` has arrived and triggers a run
through the same orchestrator a manual "Run now" uses. Only `trigger_type` differs. Locally this
runs on an in-process node-cron loop, once a minute. On Vercel it runs from Vercel Cron hitting
`POST /api/cron/tick`, which calls the same tick function.

`next_run_at` only advances when scheduling is enabled for that monitor. A crashed run reschedules
rather than retrying every minute. A per-tick batch cap avoids spiking browser concurrency if many
monitors come due at once.

`orchestrator/trigger.ts` is the single entry point for manual and scheduled runs, and refuses to
start a second run for a monitor that already has one in progress.

## Testing

```bash
npm run test:unit --workspace apps/server
```

142 unit tests across 27 files, fully offline. Coverage includes:

- Diff engine core: numeric, text, structural, functional, visual, and media changes
- The full semantic pipeline (see the failure-mode table above)
- Full-scenario regression replays against real controlled before/after fixtures
- SSRF protection: blocked schemes, localhost, private IP ranges, cloud metadata IP
- The AI layer's schema validation and no-API-key fallback path
- Cascade delete correctness, derived monitor status, run concurrency, schedule math
- Report building and evidence deduplication

There is no frontend unit test suite. Frontend changes are verified live against the running app.

## Reliability

- **Deterministic-first pipeline.** Most report-quality bugs are fixable and testable in plain
  TypeScript, without re-prompting an LLM and hoping.
- **Ownership checks everywhere.** Every monitor or run route checks `record.userId === req.userId`
  and returns 404, never 403, so a client can't confirm another user's monitor id exists.
- **Atomic cascading deletion.** Deleting a monitor is one `DELETE` against `monitored_urls`.
  Every dependent row cascades via FK constraints in the same transaction.
- **A failed capture never becomes the new baseline.** The last successful snapshot stays
  authoritative until a new capture succeeds.
- **Server crash isolation.** Every Express route is wrapped so a rejected promise becomes a
  normal 500 response instead of crashing the process, plus a global unhandled-rejection listener.
- **SSRF protection** on every capture: scheme allowlist and DNS-resolved private and cloud
  metadata IP blocking, applied before the browser navigates.
- **Rate limiting and cooldown** per user and per monitor, independent of the scheduler's own cap.
- **Grounded AI, enforced by prompt contract.** The system prompt forbids inventing causes,
  requires hedged language for interpretation, and requires citing only the evidence it was given.
- **Stale-run self-healing.** A run stuck at "running" past a timeout is auto-marked failed rather
  than blocking every future scan for that monitor.

## Usage

1. Sign in, or use the seeded demo account.
2. Add a monitor. The modal asks for the URL and check frequency in one step, or leave scheduling
   off and run it manually. Adding an already-monitored URL never creates a duplicate.
3. The first run produces a baseline report: page overview, structure, and a screenshot preview.
4. Every run after that produces a comparison report, whether or not anything meaningful changed.
   Agent Activity shows the pipeline executing stage by stage with real metrics, live during the
   run and preserved afterward.
5. History lists every scan for a monitor, with a menu for deleting a monitor entirely.
6. Analytics aggregates meaningful changes across all monitors by type, impact, and monitor.
7. Download a PDF of any comparison report.

### Demo login

```bash
npm run seed:demo-user --workspace apps/server
```

Creates a pre-confirmed account via the Supabase Admin API using `DEMO_USER_EMAIL` and
`DEMO_USER_PASSWORD` from `apps/server/.env`. Never commit a real password for this.

If Supabase isn't configured, the API falls back to one fixed demo user and skips auth entirely.

## Known limitations

- **Polling, not Realtime.** The frontend polls `/api/runs/:id` roughly every 1.2 seconds rather
  than subscribing to Supabase Realtime. Swapping in Realtime is a contained change in
  `hooks/useRun.ts`.
- **No frontend unit test suite.** Frontend correctness is verified live during development.
- **`extractPage.ts` has no unit-test harness.** It's serialized into a live browser page via
  Playwright's `page.evaluate`, so it's verified with real headless-browser runs instead.
- **Section hierarchy relies on real heading tags.** A page that uses styled divs instead of
  `h1`-`h6` for subsection titles won't have that relationship inferred.
- **Vercel Hobby plan limits.** Cron runs once a day instead of at each monitor's configured
  frequency, and function duration is capped at 60 seconds, which can occasionally time out a
  slow comparison run. The run self-heals to a clear failed state rather than hanging.

None of these affect the core loop: capture, snapshot, deterministic pipeline, AI reasoning,
report. That loop and every page in the app are live-verified against a real Supabase project.
