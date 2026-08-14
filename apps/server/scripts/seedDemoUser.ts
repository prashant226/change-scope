/**
 * Creates (or resets the password of) a pre-confirmed demo user via the
 * Supabase Admin API, using DEMO_USER_EMAIL/DEMO_USER_PASSWORD from .env.
 * Run with: npm run seed:demo-user --workspace apps/server
 *
 * This is a convenience for local/demo use only — never run this against a
 * production project with real user data using a shared password.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;

  if (!url || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/server/.env");
    process.exit(1);
  }
  if (!email || !password) {
    console.error("DEMO_USER_EMAIL and DEMO_USER_PASSWORD must be set in apps/server/.env");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("DEMO_USER_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const client = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: existing } = await client.auth.admin.listUsers();
  const found = existing?.users.find((u) => u.email === email);

  if (found) {
    const { error } = await client.auth.admin.updateUserById(found.id, { password });
    if (error) throw error;
    console.log(`Demo user already existed (${email}) — password reset to the current .env value.`);
    return;
  }

  const { error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`Demo user created: ${email}`);
}

main().catch((err) => {
  console.error("Failed to seed demo user:", err.message || err);
  process.exit(1);
});
