/**
 * Vercel serverless entrypoint. No `.listen()` — Vercel's Node runtime
 * invokes this handler per request instead of us binding a port, and there
 * is no persistent process here to run an in-process scheduler loop in
 * (see src/scheduler/index.ts + vercel.json's cron for how scheduling
 * actually happens on this deployment target).
 */
import "dotenv/config";
import { createApp } from "../src/app.js";

const app = createApp();

export default app;
