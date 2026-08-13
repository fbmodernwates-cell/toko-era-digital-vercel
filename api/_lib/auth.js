// Auth helpers for Vercel serverless functions.
// Verifies the caller's JWT, loads their profile, and enforces admin role.
// Uses Express-style (req, res) signature — NOT the Edge/Workers object-return pattern.

const {
  getUserByAccessToken,
  getProfile,
} = require("./supabase");

const ADMIN_ROLES = new Set(["admin", "superadmin"]);

/**
 * Extracts and verifies the Bearer token from the Authorization header.
 * Returns { user, error, status }.
 */
async function getUserFromRequest(req) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  if (!token) {
    return { user: null, error: "Missing Authorization Bearer token", status: 401 };
  }

  const { user, error } = await getUserByAccessToken(token);
  if (error || !user) {
    return { user: null, error: "Invalid or expired token", status: 401 };
  }

  return { user, error: null, status: 200 };
}

/**
 * Like getUserFromRequest, but also enforces that the user has admin role.
 */
async function requireAdmin(req) {
  const { user, error, status } = await getUserFromRequest(req);
  if (error) return { user: null, profile: null, error, status };

  const { data: profile, error: profileErr } = await getProfile(user.id);
  if (profileErr) {
    return {
      user: null,
      profile: null,
      error: "Failed to load profile: " + profileErr,
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

/**
 * Express-style response helper: sends a JSON response and ends the stream.
 */
function sendJson(res, body, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/**
 * Parse request body — Vercel Node.js auto-parses JSON when Content-Type
 * is application/json, putting the result in req.body. As a fallback,
 * also try parsing raw body string. Returns null on parse failure.
 */
function parseJsonBody(req) {
  // Already parsed (by Vercel middleware or by previous call)
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Convenience: wrap an admin-only handler that receives { req, res, user, profile }.
 * Signature is Express-style: module.exports = withAdmin(async ({ req, res, user, profile }) => {...})
 */
function withAdmin(handler) {
  return async (req, res) => {
    try {
      const { user, profile, error, status } = await requireAdmin(req);
      if (error) {
        sendJson(res, { error }, status);
        return;
      }
      await handler({ req, res, user, profile });
    } catch (err) {
      console.error("[api] withAdmin error:", err);
      sendJson(res, { error: "Internal server error", detail: String(err) }, 500);
    }
  };
}

/** Convenience: wrap an authenticated-user handler. */
function withUser(handler) {
  return async (req, res) => {
    try {
      const { user, error, status } = await getUserFromRequest(req);
      if (error) {
        sendJson(res, { error }, status);
        return;
      }
      await handler({ req, res, user });
    } catch (err) {
      console.error("[api] withUser error:", err);
      sendJson(res, { error: "Internal server error", detail: String(err) }, 500);
    }
  };
}

module.exports = {
  getUserFromRequest,
  requireAdmin,
  sendJson,
  parseJsonBody,
  withAdmin,
  withUser,
  ADMIN_ROLES,
};
