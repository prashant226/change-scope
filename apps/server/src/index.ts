import "dotenv/config";
import express from "express";
import cors from "cors";
import routes from "./api/routes.js";
import { requireAuth } from "./api/authMiddleware.js";
import { config } from "./utils/config.js";
import { closeBrowser } from "./browser/capture.js";
import { startScheduler } from "./scheduler/index.js";

const app = express();
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", requireAuth, routes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong on our end." });
});

const server = app.listen(config.port, () => {
  console.log(`ChangeScope server listening on http://localhost:${config.port}`);
  startScheduler();
});

async function shutdown() {
  console.log("\nShutting down...");
  server.close();
  await closeBrowser();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
