# ChangeScope — AI Web Change Intelligence

ChangeScope watches a webpage, remembers what it looked like last time, and tells you — in plain
language — what actually changed and why it might matter. It is not a diff viewer: it separates
real content/functional changes from CSS noise and uses an LLM only to reason about *significance*,
never to discover facts.

> **Status: feature-complete core product.** URL → capture → snapshot → diff → AI reasoning →
> report works end to end, with Monitors/Monitor Detail/History/Analytics pages, real Supabase
> persistence, real Supabase Auth (login/signup/forgot-password, per-user data isolation), and a
> live scheduler that runs checks automatically — all verified against a real Supabase project, not
> just typechecked. See [Known limitations](#known-limitations) for what's left (mostly polish).

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
- **Auth:** Supabase Auth (email/password) — optional, same fallback as above
- **Scheduler:** node-cron, checking once a minute for due monitors

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
3. In the **SQL Editor**, run, in order: `supabase/migrations/0001_init.sql`,
   `supabase/migrations/0002_tighten_user_fk.sql`, `supabase/migrations/0003_add_what_changed.sql`,
   then `supabase/seed/storage_buckets.sql`.
4. Put the three keys into `apps/server/.env` (see below) **and** the URL + anon key into
   `apps/web/.env` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (safe to expose client-side —
   see `apps/web/.env.example`).

Without this, the app runs on an in-memory store with no login — fine for a quick local demo, but
monitors/runs are lost on every server restart and there's no user isolation.

### Environment variables

Copy `.env.example` to `apps/server/.env` and `apps/web/.env.example` to `apps/web/.env`, then fill
in what you have:

```bash
cp .env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

**Server** (`apps/server/.env`):

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Enables AI significance reasoning. Without it, runs still work — the UI shows "AI significance analysis is temporarily unavailable" and deterministic facts still display. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Enables persistent storage (Postgres + Storage buckets) via `SupabaseStore`, **and** enables real auth enforcement on every API route. Without these, the server uses an in-memory store and a single fixed demo user id instead — no persistence, no login required. |
| `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` | Optional — run `npm run seed:demo-user --workspace apps/server` to create a pre-confirmed demo account via the Supabase Admin API (password must be 8+ characters). Otherwise, just sign up through the app's Signup page. |
| `PORT`, `FRONTEND_URL` | Server port and CORS origin. |
| `MAX_BROWSER_CONCURRENCY`, `MAX_RUNS_PER_USER`, `RUN_COOLDOWN_SECONDS`, `AI_CONTEXT_TOKEN_BUDGET`, `PAGE_CAPTURE_TIMEOUT_MS`, `MAX_SCROLL_DURATION_MS`, `MAX_SCROLL_STEPS`, `AI_RETRY_COUNT`, `AI_RETRY_DELAY_MS` | Performance guardrails, all overridable — see `apps/server/src/utils/config.ts`. |

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

Open http://localhost:5173. If Supabase is configured, you'll land on the Login screen — click
"Create account" to sign up (or use the seeded demo account, or sign in with an existing one).
Then paste a public URL and click **Run**. First run creates a baseline; run again (after the
cooldown) to see a comparison.

### Scheduler

A `node-cron` job checks once a minute for active monitors whose `next_run_at` has arrived and
triggers a run through the exact same orchestrator a manual "Run now" uses — only `trigger_type`
differs ("scheduled" vs "manual"). `next_run_at` is computed from the chosen frequency
(hourly / every 6 hours / daily / weekly) and advances after every run, whether it succeeds, only
partially completes (AI unavailable), or fails — a crashed run still reschedules rather than
getting retried every minute. A per-tick batch cap (`MAX_BROWSER_CONCURRENCY`) avoids spiking
browser concurrency if many monitors come due at once; the rest just get picked up next tick.
Runs automatically the moment the server is up — no separate process to start.

### Testing

```bash
npm run test:unit --workspace apps/server
```

26 unit tests cover: the diff engine (numeric/text/structural/functional/visual/media changes,
grouping, reordering, semantic-equivalent whitespace, unchanged elements, duplicate non-identifying
hrefs like `href="#"`), SSRF/URL validation (blocked schemes, localhost, loopback, private IP
ranges, cloud metadata IP), the AI reasoning layer (schema validation, no-API-key fallback,
empty-group short-circuit), and scheduler math (next-run-at computation per frequency).

## Demo auth

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

Built incrementally per §91 in the design spec — the core agentic loop and product screens work
end to end. Not yet implemented:

- **Realtime updates** — the frontend currently polls `/api/runs/:id` every ~1.2s rather than
  subscribing to Supabase Realtime (§64's required fallback path, used as the primary path here).
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
