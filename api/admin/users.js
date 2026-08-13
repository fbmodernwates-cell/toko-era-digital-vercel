// GET /api/admin/users
// Returns all profiles with optional filters: ?role=&banned=&q=
// Admin only.
//
// Example: GET /api/admin/users?banned=true&q=alice

const { adminClient } = require("../_lib/supabase");
const { withAdmin, json } = require("../_lib/auth");

module.exports = withAdmin(async ({ req, profile }) => {
  const { searchParams } = new URL(req.url || "", "http://localhost");
  const role = searchParams.get("role") || null;
  const banned = searchParams.get("banned");
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(Number(searchParams.get("limit") || "200"), 1000);

  const supabase = adminClient();
  let query = supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, is_banned, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (role) query = query.eq("role", role);
  if (banned === "true") query = query.eq("is_banned", true);
  if (banned === "false") query = query.eq("is_banned", false);
  if (q) {
    // Case-insensitive search across email & full_name (ilike)
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    return json({ error: "Failed to load users", detail: error.message }, 500);
  }

  return json({
    requestedBy: profile.email,
    count: count ?? data.length,
    data,
  });
});
