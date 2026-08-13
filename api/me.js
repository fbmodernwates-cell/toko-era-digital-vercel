// GET /api/me
// Returns the caller's profile based on their Bearer token.
// Useful for clients to verify auth state and load role info.

const { adminClient } = require("./_lib/supabase");
const { getUserFromRequest, json } = require("./_lib/auth");

module.exports = async (req, ctx) => {
  const { user, error, status } = await getUserFromRequest(req);
  if (error) return json({ error }, status);

  const supabase = adminClient();
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, is_banned, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr) {
    return json({ error: "Failed to load profile", detail: pErr.message }, 500);
  }

  // Load store info if user is a mitra
  let store = null;
  if (profile && profile.role !== "admin") {
    const { data: storeRow, error: storeErr } = await supabase
      .from("stores")
      .select("id, store_name, created_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!storeErr) store = storeRow;
  }

  return json({
    user: {
      id: user.id,
      email: user.email,
      aud: user.aud,
      createdAt: user.created_at,
    },
    profile,
    store,
  });
};
