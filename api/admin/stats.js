// GET /api/admin/stats
// Returns dashboard counts: users, codes (active/used), products (active/inactive), stores.
// Admin only.

const { adminClient } = require("../_lib/supabase");
const { withAdmin, json } = require("../_lib/auth");

module.exports = withAdmin(async ({ profile }) => {
  const supabase = adminClient();

  // Run independent queries in parallel
  const [
    usersRes,
    codesRes,
    productsRes,
    storesRes,
    bannedRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("registration_codes").select("id, is_used", { count: "exact" }),
    supabase.from("admin_products").select("id, is_active", { count: "exact" }),
    supabase.from("stores").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", true),
  ]);

  const codesTotal = codesRes.data?.length || 0;
  const codesUsed = codesRes.data?.filter((c) => c.is_used).length || 0;
  const codesActive = codesTotal - codesUsed;

  const productsTotal = productsRes.data?.length || 0;
  const productsActive = productsRes.data?.filter((p) => p.is_active).length || 0;
  const productsInactive = productsTotal - productsActive;

  return json({
    requestedBy: profile.email,
    counts: {
      users: usersRes.count || 0,
      bannedUsers: bannedRes.count || 0,
      stores: storesRes.count || 0,
      codes: {
        total: codesTotal,
        used: codesUsed,
        active: codesActive,
      },
      products: {
        total: productsTotal,
        active: productsActive,
        inactive: productsInactive,
      },
    },
    timestamp: new Date().toISOString(),
  });
});
