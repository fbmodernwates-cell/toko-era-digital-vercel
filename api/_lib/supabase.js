// Shared Supabase admin client factory for Vercel serverless functions.
// Uses the SERVICE ROLE key — NEVER expose this key to the browser.
// Always pair with requireAdmin() from ./auth.js to enforce access control.

const { createClient } = require("@supabase/supabase-js");

function getEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env var: ${name}. Set it in Vercel Project Settings → Environment Variables.`
    );
  }
  return v;
}

/**
 * Returns a Supabase client configured with the service role key.
 * This client bypasses Row Level Security — only use it server-side
 * and only after verifying the caller is an admin.
 */
function adminClient() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Returns a Supabase client configured with the anon key.
 * Use this for unauthenticated or anon-scoped operations.
 */
function anonClient() {
  return createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

module.exports = { adminClient, anonClient, getEnv };
