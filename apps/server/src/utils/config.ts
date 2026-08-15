/** Central place for the performance guardrails from §79 — all overridable via env. */
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: num("PORT", 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  openaiApiKey: process.env.OPENAI_API_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  maxBrowserConcurrency: num("MAX_BROWSER_CONCURRENCY", 2),
  maxRunsPerUser: num("MAX_RUNS_PER_USER", 5),
  runCooldownSeconds: num("RUN_COOLDOWN_SECONDS", 30),
  aiContextTokenBudget: num("AI_CONTEXT_TOKEN_BUDGET", 6000),
  pageCaptureTimeoutMs: num("PAGE_CAPTURE_TIMEOUT_MS", 30000),
  maxScrollDurationMs: num("MAX_SCROLL_DURATION_MS", 15000),
  maxScrollSteps: num("MAX_SCROLL_STEPS", 25),
  aiRetryCount: num("AI_RETRY_COUNT", 1),
  aiRetryDelayMs: num("AI_RETRY_DELAY_MS", 1000),
  /** Dev-only: logs every raw diff change (entity/type/subtype/before/after/parent/suppressedBy) to the server console. Never surfaced in the UI or API — see diff/debugDiff.ts. */
  debugDiff: process.env.DEBUG_DIFF === "1",
  /** Shared secret checked against POST /api/cron/tick's Authorization header on deployments where Vercel's own `x-vercel-cron` header isn't present (e.g. a manual/local test hit) — see app.ts and scheduler/index.ts. */
  cronSecret: process.env.CRON_SECRET,
};

/**
 * Fallback user id used only when Supabase isn't configured at all (so local
 * dev against the in-memory store still works without logging in). Once
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are set, every request must carry a
 * real Supabase Auth session — see api/authMiddleware.ts.
 */
export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
