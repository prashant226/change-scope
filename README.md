# ChangeScope — AI Web Change Intelligence

ChangeScope watches a webpage, remembers what it looked like last time, and tells you — in plain
language — what actually changed and why it might matter. It is not a diff viewer: it separates
real content/functional changes from CSS noise and uses an LLM only to reason about *significance*,
never to discover facts.

> **Status: core vertical slice.** URL → capture → snapshot → diff → AI reasoning → report works
> end to end (see "What's built" below). Auth, scheduler, history/analytics UI, and the
> Supabase-backed persistence layer are scaffolded but not all wired up yet — see [Known
> limitations](#known-limitations).

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
- **Database/Storage/Auth (planned wiring):** Supabase Postgres, Storage, Auth — see
  [Known limitations](#known-limitations)

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
- An OpenAI API key (optional for now — the app runs and shows deterministic results without one)
- A Supabase project (optional for now — see limitations)

### Install

```bash
npm install
npx playwright install chromium --with-deps   # from apps/server, or run once at repo root
```

### Environment variables

Copy `.env.example` to `apps/server/.env` and fill in what you have:

```bash
cp .env.example apps/server/.env
```

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Enables AI significance reasoning. Without it, runs still work — the UI shows "AI significance analysis is temporarily unavailable" and deterministic facts still display. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Not yet consumed by the storage layer (see limitations). Reserved for the Supabase-backed `StorageAdapter`. |
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

21 unit tests cover: the diff engine (numeric/text/structural/functional/visual/media changes,
grouping, reordering, semantic-equivalent whitespace, unchanged elements), SSRF/URL validation
(blocked schemes, localhost, loopback, private IP ranges, cloud metadata IP), and the AI reasoning
layer (schema validation, no-API-key fallback, empty-group short-circuit).

## Demo auth

Not wired up yet in this pass — the API runs behind a single fixed demo user id
(`DEMO_USER_ID` in `apps/server/src/utils/config.ts`) so the vertical slice can be exercised
without login. Supabase Auth email/password screens are the next layer to add (see limitations).

## Known limitations

This is the core vertical slice (§91 in the design spec — build incrementally, prove the slice
first). Not yet implemented:

- **Supabase persistence.** The app currently runs on an in-process `MemoryStore`
  (`apps/server/src/storage/memoryStore.ts`) behind the same `StorageAdapter` interface a
  Supabase-backed store will satisfy — nothing in the orchestrator or API depends on which one is
  used. Data does not survive a server restart. Migration SQL is ready in `supabase/migrations/`;
  see `docs/supabase-storage-todo.md` for the remaining wiring steps.
- **Auth screens** (login/signup/forgot-password) and real Supabase Auth.
- **Realtime updates** — the frontend currently polls `/api/runs/:id` every ~1.2s rather than
  subscribing to Supabase Realtime (§64's required fallback path, used as the primary path here).
- **Monitors / History / Analytics / Settings pages** — sidebar links are present but only
  Overview is functional today; the API endpoints for these exist (`/api/monitors`, `/history`,
  `/api/analytics`) and are unit-testable, just not yet rendered.
- **Scheduler** (node-cron) — not started; schedule fields exist on the monitor record.
- **Screenshot storage / visual preview** — screenshots are captured by Playwright but held in
  memory, not yet persisted to Supabase Storage or shown in the UI.

None of these affect the core agentic loop (capture → snapshot → diff → classify → group → AI
reason → report), which is fully working and generic.

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
