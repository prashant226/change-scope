import express from "express";
import cors from "cors";
import routes from "./api/routes.js";
import { requireAuth } from "./api/authMiddleware.js";
import { config } from "./utils/config.js";
import { runSchedulerTick } from "./scheduler/index.js";

/**
 * The Express app itself, with no `listen()` call — shared between the
 * local/long-running entrypoint (src/index.ts) and the Vercel serverless
 * entrypoint (api/index.ts), which hands requests to Vercel's Node runtime
 * instead of binding a port itself.
 */
export function createApp() {
  const app = express();
  app.use(cors({ origin: config.frontendUrl }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", requireAuth, routes);

  // Scheduler tick, triggered by Vercel Cron (see vercel.json) instead of an
  // in-process node-cron loop — a serverless function has no persistent
  // process to run that loop in. Protected by a shared secret so it can't be
  // triggered by anyone who finds the URL; Vercel also sends its own
  // `x-vercel-cron` header on real cron invocations, checked as a second signal.
  app.post("/api/cron/tick", async (req, res) => {
    const auth = req.header("authorization");
    const expected = config.cronSecret ? `Bearer ${config.cronSecret}` : undefined;
    const isVercelCron = req.header("x-vercel-cron") !== undefined;
    if (!isVercelCron && (!expected || auth !== expected)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      const result = await runSchedulerTick();
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error("[cron] Tick failed:", err);
      res.status(500).json({ ok: false, error: "Tick failed" });
    }
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[server] Unhandled error:", err);
    res.status(500).json({ error: "Something went wrong on our end." });
  });

  return app;
}
