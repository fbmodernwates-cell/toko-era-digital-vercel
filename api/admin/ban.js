// POST /api/admin/ban
// Body: { userId: string, banned: boolean }

const {
  getProfile,
  updateProfile,
} = require("../_lib/supabase");
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
  if (userId === profile.id) {
    return json({ error: "You cannot ban or unban your own account" }, 400);
  }

  // Verify target exists
  const { data: target, error: targetErr } = await getProfile(userId);
  if (targetErr) return json({ error: "Failed to load target user", detail: targetErr }, 500);
  if (!target) return json({ error: "Target user not found" }, 404);

  // Prevent banning other admins
  if (String(target.role || "").toLowerCase() === "admin" && banned) {
    return json({ error: "Cannot ban another admin account" }, 400);
  }

  const { data: updated, error } = await updateProfile(userId, { is_banned: banned });
  if (error) return json({ error: "Failed to update ban status", detail: error }, 500);

  return json({
    success: true,
    target: updated,
    action: banned ? "banned" : "unbanned",
    performedBy: profile.email,
  });
});
