/**
 * Storage factory. Uses Supabase when SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
 * are configured; otherwise falls back to the in-memory store so the vertical
 * slice can be demoed before Supabase is wired up (§59, §65).
 *
 * A Supabase-backed StorageAdapter can be dropped in here later without
 * touching the orchestrator or API layer — they only depend on the interface.
 */
import { MemoryStore } from "./memoryStore.js";
import type { StorageAdapter } from "./types.js";

let instance: StorageAdapter | null = null;

export function getStore(): StorageAdapter {
  if (!instance) {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn(
        "[storage] Supabase credentials detected but the Supabase-backed StorageAdapter is not implemented yet — using in-memory store. See docs/supabase-storage-todo.md.",
      );
    }
    instance = new MemoryStore();
  }
  return instance;
}

export * from "./types.js";
