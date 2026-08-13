// GET /api/health
// Public health check — no auth required. Used by Vercel uptime monitoring.

module.exports = async (req, _ctx) => {
  // Optional: verify Supabase env vars are configured
  const configured = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].reduce((acc, k) => ({ ...acc, [k]: Boolean(process.env[k]) }), {});

  const allConfigured = Object.values(configured).every(Boolean);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      status: allConfigured ? "ok" : "degraded",
      service: "toko-era-digital-api",
      timestamp: new Date().toISOString(),
      env: configured,
    }),
  };
};
