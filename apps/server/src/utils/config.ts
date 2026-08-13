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
  maxBrowserConcurrency: num("MAX_BROWSER_CONCURRENCY", 2),
  maxRunsPerUser: num("MAX_RUNS_PER_USER", 5),
  runCooldownSeconds: num("RUN_COOLDOWN_SECONDS", 30),
  aiContextTokenBudget: num("AI_CONTEXT_TOKEN_BUDGET", 6000),
  pageCaptureTimeoutMs: num("PAGE_CAPTURE_TIMEOUT_MS", 30000),
  maxScrollDurationMs: num("MAX_SCROLL_DURATION_MS", 15000),
  maxScrollSteps: num("MAX_SCROLL_STEPS", 25),
  aiRetryCount: num("AI_RETRY_COUNT", 1),
  aiRetryDelayMs: num("AI_RETRY_DELAY_MS", 1000),
};

/** Single demo user until Supabase Auth is wired in (§68). */
export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
