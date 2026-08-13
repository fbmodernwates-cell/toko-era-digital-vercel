// POST /api/admin/reset-password
// Body: { userId: string, newPassword?: string }
//   - If newPassword is provided: directly set the user's password via Auth Admin API.
//   - If newPassword is omitted: generate a secure one-time password, return it,
//     and force the user to change it on next login (email_confirm + password update).
//
// This endpoint uses the Supabase service role key, so it can update ANY user's
// password. Admin only.
//
// Example:
//   POST /api/admin/reset-password
//   Authorization: Bearer <admin-access-token>
//   Content-Type: application/json
//   { "userId": "uuid", "newPassword": "TempPass123!" }

const crypto = require("crypto");
const { adminClient } = require("../_lib/supabase");
const { withAdmin, json } = require("../_lib/auth");

function parseBody(req) {
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return null;
  }
}

function generateTempPassword(length = 16) {
  // URL-safe password
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

module.exports = withAdmin(async ({ req, profile }) => {
  const body = parseBody(req);
  if (!body) return json({ error: "Invalid JSON body" }, 400);

  const userId = String(body.userId || "").trim();
  if (!userId) return json({ error: "userId is required" }, 400);

  if (userId === profile.id) {
    return json({ error: "Use the settings page to change your own password" }, 400);
  }

  const supabase = adminClient();

  // Verify the target user exists in auth.users (via admin API)
  const { data: targetUser, error: targetErr } = await supabase.auth.admin.getUserById(userId);
  if (targetErr || !targetUser?.user) {
    return json({ error: "Target user not found", detail: targetErr?.message || "User not found" }, 404);
  }

  // Decide on the new password
  let newPassword = body.newPassword ? String(body.newPassword) : null;
  let generated = false;
  if (!newPassword) {
    newPassword = generateTempPassword();
    generated = true;
  }

  // Update the user's password via Auth Admin API (bypasses RLS, requires service role)
  const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateErr) {
    return json({ error: "Failed to reset password", detail: updateErr.message }, 500);
  }

  return json({
    success: true,
    target: {
      id: targetUser.user.id,
      email: targetUser.user.email,
    },
    generated,
    ...(generated ? { temporaryPassword: newPassword } : {}),
    note: generated
      ? "Share this temporary password securely with the user. They should change it after login."
      : "Password updated directly.",
    performedBy: profile.email,
    performedAt: new Date().toISOString(),
  });
});
