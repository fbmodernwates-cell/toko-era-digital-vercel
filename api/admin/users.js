// GET /api/admin/users
// Returns all profiles with optional filters.

const { listProfiles } = require("../_lib/supabase");
const { withAdmin, json } = require("../_lib/auth");

module.exports = withAdmin(async ({ req, profile }) => {
  const { searchParams } = new URL(req.url || "", "http://localhost");
  const role = searchParams.get("role") || null;
  const banned = searchParams.get("banned");
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(Number(searchParams.get("limit") || "200"), 1000);

  const opts = { limit };
  if (role) opts.role = role;
  if (banned === "true") opts.banned = true;
  if (banned === "false") opts.banned = false;
  if (q) opts.q = q;

  const { data, error, count } = await listProfiles(opts);
  if (error) return json({ error: "Failed to load users", detail: error }, 500);

  return json({
    requestedBy: profile.email,
    count: count ?? data.length,
    data,
  });
});
