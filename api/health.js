// GET /api/health
// Public health check — no auth, no Supabase SDK import needed.
// Used by Vercel uptime monitoring and as a fast cold-start probe.

module.exports = async (req, _ctx) => {
  const configured = {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const allConfigured = Object.values(configured).every(Boolean);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      status: allConfigured ? "ok" : "degraded",
      service: "toko-era-digital-api",
      timestamp: new Date().toISOString(),
      env: configured,
      node: process.version,
    }),
  };
};
