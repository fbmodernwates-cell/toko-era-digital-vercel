// GET /api/health
// Public health check — no auth, no Supabase calls.
// Express-style (req, res) signature for Vercel Node.js runtime.

module.exports = (req, res) => {
  const configured = {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const allConfigured = Object.values(configured).every(Boolean);

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({
    status: allConfigured ? "ok" : "degraded",
    service: "toko-era-digital-api",
    timestamp: new Date().toISOString(),
    env: configured,
    node: process.version,
  }));
};
