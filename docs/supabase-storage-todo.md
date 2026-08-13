# Supabase-backed storage — not yet implemented

The vertical slice currently runs on `MemoryStore` (`apps/server/src/storage/memoryStore.ts`),
which satisfies the same `StorageAdapter` interface a Supabase implementation will.

To wire up real persistence once Supabase credentials are available:

1. Run `supabase/migrations/0001_init.sql` against your project.
2. Run `supabase/seed/storage_buckets.sql` to create the `screenshots` and `raw-html` buckets.
3. Implement `SupabaseStore implements StorageAdapter` in `apps/server/src/storage/supabaseStore.ts`,
   mapping each method to the corresponding table (see §65 in the master spec for the schema).
4. Update `apps/server/src/storage/index.ts` to return `new SupabaseStore()` when
   `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set.
5. Upload screenshot/raw HTML buffers to Storage instead of holding them in memory.

Nothing in the orchestrator or API layer needs to change — they only depend on `StorageAdapter`.
