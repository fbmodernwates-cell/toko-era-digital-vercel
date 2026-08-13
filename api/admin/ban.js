// POST /api/admin/ban
// Body: { userId: string, banned: boolean }
// Bans or unbans a user (sets is_banned on their profile).
// Admin only.
//
// Example:
//   POST /api/admin/ban
//   Authorization: Bearer <admin-access-token>
//   Content-Type: application/json
//   { "userId": "uuid", "banned": true }

const { adminClient } = require("../_lib/supabase");
const { withAdmin, json } = require("../_lib/auth");

function parseBody(req) {
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return null;
  }
}

module.exports = withAdmin(async ({ req, profile }) => {
  const body = parseBody(req);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const userId = String(body.userId || "").trim();
  const banned = Boolean(body.banned);

  if (!userId) return json({ error: "userId is required" }, 400);

  // Prevent self-ban to avoid lockout
  if (userId === profile.id) {
    return json({ error: "You cannot ban or unban your own account" }, 400);
  }

  const supabase = adminClient();

  // Verify the target user exists
  const { data: target, error: targetErr } = await supabase
    .from("profiles")
    .select("id, email, role, is_banned")
    .eq("id", userId)
    .maybeSingle();

  if (targetErr) return json({ error: "Failed to load target user", detail: targetErr.message }, 500);
  if (!target) return json({ error: "Target user not found" }, 404);

  // Prevent banning other admins
  if (String(target.role || "").toLowerCase() === "admin" && banned) {
    return json({ error: "Cannot ban another admin account" }, 400);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ is_banned: banned })
    .eq("id", userId)
    .select("id, email, is_banned")
    .single();

  if (error) return json({ error: "Failed to update ban status", detail: error.message }, 500);

  return json({
    success: true,
    target: data,
    action: banned ? "banned" : "unbanned",
    performedBy: profile.email,
  });
});
