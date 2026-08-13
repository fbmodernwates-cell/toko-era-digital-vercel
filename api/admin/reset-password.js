// POST /api/admin/reset-password
// Body: { userId, newPassword? }

const crypto = require("crypto");
const { adminGetUserById, adminUpdateUserById } = require("../_lib/supabase");
const { withAdmin, sendJson } = require("../_lib/auth");

function parseBody(req) {
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return null;
  }
}

function generateTempPassword(length = 16) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

module.exports = withAdmin(async ({ req, res, profile }) => {
  const body = parseBody(req);
  if (!body) return sendJson(res, { error: "Invalid JSON body" }, 400);

  const userId = String(body.userId || "").trim();
  if (!userId) return sendJson(res, { error: "userId is required" }, 400);
  if (userId === profile.id) {
    return sendJson(res, { error: "Use the settings page to change your own password" }, 400);
  }

  const { data: targetUser, error: targetErr } = await adminGetUserById(userId);
  if (targetErr || !targetUser) {
    return sendJson(res, { error: "Target user not found", detail: targetErr || "User not found" }, 404);
  }

  let newPassword = body.newPassword ? String(body.newPassword) : null;
  let generated = false;
  if (!newPassword) {
    newPassword = generateTempPassword();
    generated = true;
  }

  const { data: updated, error: updateErr } = await adminUpdateUserById(userId, {
    password: newPassword,
  });
  if (updateErr) {
    return sendJson(res, { error: "Failed to reset password", detail: updateErr }, 500);
  }

  return sendJson(res, {
    success: true,
    target: { id: targetUser.id, email: targetUser.email },
    generated,
    ...(generated ? { temporaryPassword: newPassword } : {}),
    note: generated
      ? "Share this temporary password securely with the user."
      : "Password updated directly.",
    performedBy: profile.email,
    performedAt: new Date().toISOString(),
  });
});
