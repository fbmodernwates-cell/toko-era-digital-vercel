// GET /api/admin/stats
// Returns dashboard counts.

const { countRows, listTable } = require("../_lib/supabase");
const { withAdmin, sendJson } = require("../_lib/auth");

module.exports = withAdmin(async ({ req, res, profile }) => {
  const [usersRes, codesRes, productsRes, storesRes, bannedRes] = await Promise.all([
    countRows("profiles"),
    listTable("registration_codes", { select: "id,is_used", limit: 1000 }),
    listTable("admin_products", { select: "id,is_active", limit: 1000 }),
    countRows("stores"),
    countRows("profiles", "is_banned=eq.true"),
  ]);

  const codesTotal = codesRes.data?.length || 0;
  const codesUsed = codesRes.data?.filter((c) => c.is_used).length || 0;
  const codesActive = codesTotal - codesUsed;

  const productsTotal = productsRes.data?.length || 0;
  const productsActive = productsRes.data?.filter((p) => p.is_active).length || 0;
  const productsInactive = productsTotal - productsActive;

  return sendJson(res, {
    requestedBy: profile.email,
    counts: {
      users: usersRes.count || 0,
      bannedUsers: bannedRes.count || 0,
      stores: storesRes.count || 0,
      codes: { total: codesTotal, used: codesUsed, active: codesActive },
      products: { total: productsTotal, active: productsActive, inactive: productsInactive },
    },
    timestamp: new Date().toISOString(),
  });
});
