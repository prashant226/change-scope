/**
 * Root-level adapter so Vercel's zero-config `/api` function discovery
 * (which only scans the project's own root `api/` directory) picks up the
 * real Express app, which lives inside the `apps/server` workspace — see
 * apps/server/api/index.ts and apps/server/src/app.ts for the actual app.
 */
export { default } from "../apps/server/api/index.js";
