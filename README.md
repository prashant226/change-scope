# ChangeScope — AI Web Change Intelligence

ChangeScope watches a webpage, remembers what it looked like last time, and tells you — in plain
language — what actually changed and why it might matter. It is not a diff viewer: it separates
real content/functional changes from CSS noise and uses an LLM only to reason about *significance*,
never to discover facts.

> **Status: core product working.** URL → capture → snapshot → diff → AI reasoning → report works
> end to end, with Monitors/Monitor Detail/History/Analytics pages and optional Supabase
> persistence. Auth and the scheduler aren't wired up yet — see [Known limitations](#known-limitations).

## Product use case

An employee wants to monitor a webpage — a product page, a pricing page, a careers page — and be
told when something meaningful changes, without reading a wall of raw diff output. Example:

```
Price changed from ₹49,999 to ₹44,999
Why it might be significant: The ~10% price reduction may indicate a promotional
pricing adjustment and could affect purchase decisions.
```

The demo target is a fictional e-commerce page ("ShopKart"), but the agent has **no ShopKart-specific
logic anywhere** — the snapshot schema and diff engine are fully generic and work on any public URL.

## Architecture

```
User pastes URL
      │
      ▼
POST /api/runs ──► create/find monitor ──► create run row ──► respond with runId (fire-and-forget)
                                                    │
                                                    ▼
                                          orchestrator.executeRun()
                                                    │
      ┌─────────────────────────────────────────────┴──────────────────────────────────────┐
      │  validating_url → finding_previous_snapshot → opening_page/rendering/capturing       │
      │       → building_snapshot → saving_snapshot → comparing → classifying → grouping     │
      │       → ai_reasoning → building_report → completed/failed                            │
      │  (every stage appends an agent_log row; frontend polls /runs/:id + /runs/:id/logs)    │
      └───────────────────────────────────────────────────────────────────────────────────────┘
                                                    │
                        ┌───────────────────────────┼───────────────────────────┐
                        ▼                           ▼                           ▼
                 Playwright capture         Deterministic diff engine     OpenAI GPT-5 mini
                 (browser/capture.ts,       (matches elements across      (ai/reason.ts —
                 extractPage.ts) → generic  snapshots via multiple        judges meaningfulness,
                 PageSnapshot (snapshot/)   signals, not DOM index;       significance, and writes
                                            classifies content/          one grounded sentence per
                                            structural/functional/       change group; falls back
                                            visual/media)                to facts-only on failure)
```

**Core principle:** deterministic code discovers *what* changed; the LLM only judges *whether it
matters* and *why*. See `apps/server/src/diff`, `classifier`, and `ai` for the boundary.

## Tech stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Lucide icons
- **Backend:** Node.js + TypeScript + Express
- **Browser automation:** Playwright (Chromium)
- **AI:** OpenAI Responses API, GPT-5 mini, strict JSON-schema output validated with Zod
- **Diff:** custom deterministic TypeScript (no LLM involved)
- **Database/Storage:** Supabase Postgres + Storage (optional — falls back to an in-memory store
  when not configured; see below)
- **Auth (planned wiring):** Supabase Auth — see [Known limitations](#known-limitations)

No Redis, no queues, no vector DB — see `docs/supabase-storage-todo.md` for what's intentionally
deferred.

## Project layout

```
apps/
  web/     React frontend (Vite)
  server/  Express backend — orchestrator, browser capture, snapshot, diff, classifier, ai, api
supabase/
  migrations/   SQL schema (§65 in the design spec)
  seed/         storage bucket setup
tests/           (reserved for integration/e2e fixtures)
apps/server/tests-unit/   Vitest unit tests (diff engine, URL safety, AI fallback/schema)
docs/            architecture notes, follow-up TODOs
```

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
3. In the **SQL Editor**, run `supabase/migrations/0001_init.sql`, then
   `supabase/seed/storage_buckets.sql`.
4. Put the three keys into `apps/server/.env` (see below).

Without this, the app runs on an in-memory store — fine for a quick local demo, but monitors/runs
are lost on every server restart.

### Environment variables

Copy `.env.example` to `apps/server/.env` and fill in what you have:

```bash
cp .env.example apps/server/.env
```

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Enables AI significance reasoning. Without it, runs still work — the UI shows "AI significance analysis is temporarily unavailable" and deterministic facts still display. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Enables persistent storage (Postgres + Storage buckets) via `SupabaseStore`. Without these, the server uses an in-memory store instead — same behavior, no persistence across restarts. `SUPABASE_ANON_KEY` is reserved for the frontend once Supabase Auth is wired up; the server currently only needs the service-role key. |
| `PORT`, `FRONTEND_URL` | Server port and CORS origin. |
| `MAX_BROWSER_CONCURRENCY`, `MAX_RUNS_PER_USER`, `RUN_COOLDOWN_SECONDS`, `AI_CONTEXT_TOKEN_BUDGET`, `PAGE_CAPTURE_TIMEOUT_MS`, `MAX_SCROLL_DURATION_MS`, `MAX_SCROLL_STEPS`, `AI_RETRY_COUNT`, `AI_RETRY_DELAY_MS` | Performance guardrails, all overridable — see `apps/server/src/utils/config.ts`. |

### Run locally

```bash
# terminal 1
npm run dev:server   # http://localhost:4000

# terminal 2
npm run dev:web      # http://localhost:5173 (proxies /api to :4000)
```

Open http://localhost:5173, paste a public URL, click **Run**. First run creates a baseline; run
again (after the cooldown) to see a comparison.

### Testing

```bash
npm run test:unit --workspace apps/server
```

22 unit tests cover: the diff engine (numeric/text/structural/functional/visual/media changes,
grouping, reordering, semantic-equivalent whitespace, unchanged elements, duplicate non-identifying
hrefs like `href="#"`), SSRF/URL validation (blocked schemes, localhost, loopback, private IP
ranges, cloud metadata IP), and the AI reasoning layer (schema validation, no-API-key fallback,
empty-group short-circuit).

## Demo auth

Not wired up yet — the API runs behind a single fixed demo user id so the app can be exercised
without login. See [Known limitations](#known-limitations) for what that means for the schema.

## Known limitations

Built incrementally per §91 in the design spec — the core agentic loop and product screens work
end to end. Not yet implemented:

- **Auth screens** (login/signup/forgot-password) and real Supabase Auth. The API runs behind a
  single fixed demo user id (`DEMO_USER_ID` in `apps/server/src/utils/config.ts`). Because of this,
  `monitored_urls.user_id` / `runs.user_id` are plain `uuid` columns with no FK to `auth.users` yet
  (a real FK would reject every insert against a user that doesn't exist) — see
  `docs/supabase-storage-todo.md` for the one-line migration to add once auth ships.
- **Realtime updates** — the frontend currently polls `/api/runs/:id` every ~1.2s rather than
  subscribing to Supabase Realtime (§64's required fallback path, used as the primary path here).
- **Scheduler** (node-cron) — not started; schedule fields exist on the monitor record and are
  editable from Settings, but nothing triggers a run automatically yet. "Run now" always works.
- **Visual preview** — screenshots are captured by Playwright and uploaded to Supabase Storage
  when configured, but nothing in the UI displays them yet (paths are on the `snapshots` row,
  ready for that feature).

None of these affect the core agentic loop (capture → snapshot → diff → classify → group → AI
reason → report) or the Overview/Monitors/Monitor Detail/History/Analytics screens, which are
fully working and generic.

## Why these choices

- **Deterministic diff + LLM reasoning, not "send the page to GPT":** raw HTML diffing is noisy
  and non-generic; blind LLM diffing is slow, expensive, and prone to inventing causes. Splitting
  "what changed" (code) from "why it might matter" (LLM) keeps the system fast, cheap, and
  explainable.
- **Playwright:** the target page must be observed as rendered — JS-heavy pages, lazy content, and
  consent overlays need a real browser, not a raw HTTP fetch.
- **Supabase (planned):** one hosted Postgres + Storage + Auth service covers the whole persistence
  surface without adding Redis/queues/a second database.
- **GPT-5 mini via the Responses API with strict JSON schema:** cheap enough for one call per run,
  structured output means we never trust free-form text as fact.
