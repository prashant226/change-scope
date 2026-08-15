import "dotenv/config";
import { createApp } from "./app.js";
import { config } from "./utils/config.js";
import { closeBrowser } from "./browser/capture.js";
import { startScheduler } from "./scheduler/index.js";

// Defense in depth: routes.ts wraps every handler so request-triggered
// errors become normal 500 responses, but this catches anything that still
// slips through (e.g. a rejection outside the request lifecycle) so it's
// logged instead of silently taking the whole server down.
process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled promise rejection:", reason);
});

const app = createApp();

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
