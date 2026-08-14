# Supabase-backed storage

`SupabaseStore` (`apps/server/src/storage/supabaseStore.ts`) implements the same
`StorageAdapter` interface as `MemoryStore`, mapping camelCase domain records to
the snake_case schema in `supabase/migrations/0001_init.sql` and uploading
screenshots/raw HTML to Supabase Storage instead of holding them in memory.

## To activate it

1. Create a Supabase project (see README for step-by-step).
2. Run `supabase/migrations/0001_init.sql` in the SQL Editor.
3. Run `supabase/seed/storage_buckets.sql` to create the `screenshots` and `raw-html` buckets.
4. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `apps/server/.env`.
5. Restart the server. `storage/index.ts` picks `SupabaseStore` automatically
   once both env vars are present — nothing else needs to change.

## `user_id` FK to `auth.users` — resolved

Real Supabase Auth is now wired up (`apps/server/src/api/authMiddleware.ts` verifies
the caller's session on every request; the frontend has real Login/Signup/Forgot-password
screens). `supabase/migrations/0002_tighten_user_fk.sql` adds the FK back, using
`NOT VALID` so any pre-existing rows (e.g. demo data inserted under the old fixed
`DEMO_USER_ID` before auth existed) are grandfathered in rather than blocking the
migration. New inserts are fully enforced. Run the migration if you haven't yet.

The RLS policies from 0001 are still inert for the server's own requests — it
uses the `service_role` key, which bypasses RLS — but ownership is enforced at
the application layer instead (every route checks `monitor.userId === req.userId`
before returning data; see `api/routes.ts`). RLS matters if anything ever queries
Supabase directly with the anon key (e.g. a future client-side Realtime subscription).

`DEMO_USER_ID` still exists as a fallback for when Supabase isn't configured at
all (local dev against `MemoryStore`, no login required) — see README.

## Not yet re-exposed from Storage

`getSnapshot` / `listSnapshotsForMonitor` don't re-download the screenshot or
raw HTML from Storage — nothing reads them back yet (no visual-preview UI).
The paths are on the `snapshots` row (`screenshot_path`, `raw_html_path`) for
whenever that feature is built.
