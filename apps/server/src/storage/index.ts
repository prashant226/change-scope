/**
 * Storage factory. Uses Supabase when SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
 * are configured; otherwise falls back to the in-memory store so the vertical
 * slice can be demoed before Supabase is wired up (§59, §65).
 *
 * Nothing outside this file needs to know which one is active — the
 * orchestrator and API layer only depend on the StorageAdapter interface.
 */
import { MemoryStore } from "./memoryStore.js";
import { SupabaseStore } from "./supabaseStore.js";
import type { StorageAdapter } from "./types.js";

let instance: StorageAdapter | null = null;

export function getStore(): StorageAdapter {
  if (!instance) {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceRoleKey) {
      console.log("[storage] Using Supabase-backed storage.");
      instance = new SupabaseStore(url, serviceRoleKey);
    } else {
      console.log("[storage] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — using in-memory storage (data will not survive a restart).");
      instance = new MemoryStore();
    }
  }
  return instance;
}

export * from "./types.js";
