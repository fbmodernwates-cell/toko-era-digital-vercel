// POST /api/admin/ban
// Body: { userId, banned }

const { getProfile, updateProfile } = require("../_lib/supabase");
const { withAdmin, sendJson, parseJsonBody } = require("../_lib/auth");

module.exports = withAdmin(async ({ req, res, profile }) => {
  const body = parseJsonBody(req);
  if (!body) return sendJson(res, { error: "Invalid JSON body" }, 400);

  const userId = String(body.userId || "").trim();
  const banned = Boolean(body.banned);

  if (!userId) return sendJson(res, { error: "userId is required" }, 400);
  if (userId === profile.id) {
    return sendJson(res, { error: "You cannot ban or unban your own account" }, 400);
  }

  const { data: target, error: targetErr } = await getProfile(userId);
  if (targetErr) return sendJson(res, { error: "Failed to load target user", detail: targetErr }, 500);
  if (!target) return sendJson(res, { error: "Target user not found" }, 404);

  if (String(target.role || "").toLowerCase() === "admin" && banned) {
    return sendJson(res, { error: "Cannot ban another admin account" }, 400);
  }

  const { data: updated, error } = await updateProfile(userId, { is_banned: banned });
  if (error) return sendJson(res, { error: "Failed to update ban status", detail: error }, 500);

  return sendJson(res, {
    success: true,
    target: updated,
    action: banned ? "banned" : "unbanned",
    performedBy: profile.email,
  });
});
