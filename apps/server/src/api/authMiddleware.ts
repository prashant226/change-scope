/**
 * Verifies the caller's Supabase Auth session and attaches the real user id
 * to the request. When Supabase isn't configured at all, falls back to the
 * fixed demo user so local dev against the in-memory store keeps working
 * without login (§68) — but once Supabase credentials are present, every
 * request must carry a valid bearer token.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import { config, DEMO_USER_ID } from "../utils/config.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

let authClient: SupabaseClient | null = null;

function getAuthClient(): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return null;
  if (!authClient) {
    authClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return authClient;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const client = getAuthClient();
  if (!client) {
    req.userId = DEMO_USER_ID;
    return next();
  }

  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    return res.status(401).json({ error: "Sign in required." });
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }

  req.userId = data.user.id;
  next();
}
