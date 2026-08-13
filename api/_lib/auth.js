// Auth helpers for Vercel serverless functions.
// Verifies the caller's JWT, loads their profile, and enforces admin role.

const { adminClient } = require("./supabase");

const ADMIN_ROLES = new Set(["admin", "superadmin"]);

/**
 * Extracts and verifies the Bearer token from the Authorization header.
 * Returns { user, error, status }.
 *   - On success: { user, error: null, status: 200 }
 *   - On failure: { user: null, error: "<message>", status: 401|500 }
 */
async function getUserFromRequest(req) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return { user: null, error: "Missing Authorization Bearer token", status: 401 };
  }

  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return { user: null, error: "Invalid or expired token", status: 401 };
  }

  return { user: data.user, error: null, status: 200 };
}

/**
 * Like getUserFromRequest, but also enforces that the user has admin role.
 * Returns { user, profile, error, status }.
 */
async function requireAdmin(req) {
  const { user, error, status } = await getUserFromRequest(req);
  if (error) return { user: null, profile: null, error, status };

  const supabase = adminClient();
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, email, role, is_banned, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    return {
      user: null,
      profile: null,
      error: "Failed to load profile: " + profileErr.message,
      status: 500,
    };
  }
  if (!profile) {
    return { user: null, profile: null, error: "Profile not found", status: 403 };
  }
  if (profile.is_banned) {
    return { user: null, profile: null, error: "Account is banned", status: 403 };
  }
  if (!ADMIN_ROLES.has(String(profile.role || "").toLowerCase())) {
    return {
      user: null,
      profile: null,
      error: "Forbidden: admin role required",
      status: 403,
    };
  }

  return { user, profile, error: null, status: 200 };
}

/** Standard JSON response helper. */
function json(body, status = 200) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

/** Convenience: wrap an async handler that receives { req, user, profile } and returns JSON. */
function withAdmin(handler) {
  return async (req, _ctx) => {
    try {
      const { user, profile, error, status } = await requireAdmin(req);
      if (error) return json({ error }, status);
      return await handler({ req, user, profile });
    } catch (err) {
      console.error("[api] withAdmin error:", err);
      return json({ error: "Internal server error", detail: String(err) }, 500);
    }
  };
}

/** Convenience: wrap an async handler for any authenticated user (not just admin). */
function withUser(handler) {
  return async (req, _ctx) => {
    try {
      const { user, error, status } = await getUserFromRequest(req);
      if (error) return json({ error }, status);
      return await handler({ req, user });
    } catch (err) {
      console.error("[api] withUser error:", err);
      return json({ error: "Internal server error", detail: String(err) }, 500);
    }
  };
}

module.exports = {
  getUserFromRequest,
  requireAdmin,
  json,
  withAdmin,
  withUser,
  ADMIN_ROLES,
};
