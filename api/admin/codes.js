// /api/admin/codes
// GET    /api/admin/codes              → list all registration codes
// POST   /api/admin/codes              → generate N codes { count?: 1, expires_at?: ISO string }
// DELETE /api/admin/codes?id=<uuid>    → delete a code
//
// Admin only.

const { adminClient } = require("../_lib/supabase");
const { withAdmin, json } = require("../_lib/auth");

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

function generateCode(prefix = "TED") {
  let code = `${prefix}-`;
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
}

function parseBody(req) {
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return null;
  }
}

module.exports = withAdmin(async ({ req, profile }) => {
  const supabase = adminClient();
  const method = (req.method || "GET").toUpperCase();

  // ---------- GET: list ----------
  if (method === "GET") {
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const isUsed = searchParams.get("used");
    const limit = Math.min(Number(searchParams.get("limit") || "200"), 1000);

    let q = supabase
      .from("registration_codes")
      .select("id, code, is_used, used_by, expires_at, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (isUsed === "true") q = q.eq("is_used", true);
    if (isUsed === "false") q = q.eq("is_used", false);

    const { data, error, count } = await q;
    if (error) return json({ error: "Failed to load codes", detail: error.message }, 500);
    return json({ count: count ?? data.length, data });
  }

  // ---------- POST: generate ----------
  if (method === "POST") {
    const body = parseBody(req);
    if (!body) return json({ error: "Invalid JSON body" }, 400);

    const count = Math.max(1, Math.min(Number(body.count || 1), 100));
    const prefix = body.prefix ? String(body.prefix).toUpperCase().slice(0, 8) : "TED";
    const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;

    const codes = Array.from({ length: count }, () => ({
      code: generateCode(prefix),
      expires_at: expiresAt,
    }));

    const { data, error } = await supabase
      .from("registration_codes")
      .insert(codes)
      .select("id, code, expires_at, created_at");

    if (error) return json({ error: "Failed to generate codes", detail: error.message }, 500);
    return json({ count: data.length, data, createdBy: profile.email }, 201);
  }

  // ---------- DELETE ----------
  if (method === "DELETE") {
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const id = searchParams.get("id");
    if (!id) return json({ error: "id query param is required" }, 400);

    const { error, count } = await supabase
      .from("registration_codes")
      .delete()
      .eq("id", id);
    if (error) return json({ error: "Failed to delete code", detail: error.message }, 500);
    if (count === 0) return json({ error: "Code not found" }, 404);
    return json({ success: true, id });
  }

  return json({ error: `Method ${method} not allowed` }, 405);
});
