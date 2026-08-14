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

## Known temporary compromise: `user_id` has no FK to `auth.users`

Supabase Auth isn't wired up yet (see README limitations), so the server runs
behind one fixed demo user id (`DEMO_USER_ID` in `apps/server/src/utils/config.ts`)
that doesn't exist as a real `auth.users` row. The migration's `user_id` columns
are plain `uuid` with no foreign key for this reason — a real FK would reject
every insert today. The RLS policies are already written against `auth.uid()`
and are ready to go, but currently inert because the server queries with the
`service_role` key (which bypasses RLS) rather than a real user session.

Once Supabase Auth ships:
```sql
alter table monitored_urls add constraint monitored_urls_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table runs add constraint runs_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
```

## Not yet re-exposed from Storage

`getSnapshot` / `listSnapshotsForMonitor` don't re-download the screenshot or
raw HTML from Storage — nothing reads them back yet (no visual-preview UI).
The paths are on the `snapshots` row (`screenshot_path`, `raw_html_path`) for
whenever that feature is built.
