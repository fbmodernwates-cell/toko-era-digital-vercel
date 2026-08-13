// GET /api/me
// Returns the caller's profile based on their Bearer token.

const { getProfile, listTable } = require("./_lib/supabase");
const { getUserFromRequest, sendJson } = require("./_lib/auth");

module.exports = async (req, res) => {
  const { user, error, status } = await getUserFromRequest(req);
  if (error) return sendJson(res, { error }, status);

  const { data: profile, error: pErr } = await getProfile(user.id);
  if (pErr) {
    return sendJson(res, { error: "Failed to load profile", detail: pErr }, 500);
  }

  let store = null;
  if (profile && profile.role !== "admin") {
    const { data: stores, error: storeErr } = await listTable("stores", {
      select: "id,store_name,created_at",
      eq: { user_id: user.id },
      limit: 1,
    });
    if (!storeErr && stores && stores.length > 0) store = stores[0];
  }

  return sendJson(res, {
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
