// /api/admin/codes
// GET    /api/admin/codes
// POST   /api/admin/codes
// DELETE /api/admin/codes?id=<uuid>

const { listTable, insertRow, deleteRow } = require("../_lib/supabase");
const { withAdmin, sendJson } = require("../_lib/auth");

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

module.exports = withAdmin(async ({ req, res, profile }) => {
  const method = (req.method || "GET").toUpperCase();

  if (method === "GET") {
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const isUsed = searchParams.get("used");
    const limit = Math.min(Number(searchParams.get("limit") || "200"), 1000);

    const opts = {
      select: "id,code,is_used,used_by,expires_at,created_at",
      order: "created_at.desc",
      limit,
    };
    if (isUsed === "true") opts.eq = { is_used: true };
    if (isUsed === "false") opts.eq = { is_used: false };

    const { data, error, count } = await listTable("registration_codes", opts);
    if (error) return sendJson(res, { error: "Failed to load codes", detail: error }, 500);
    return sendJson(res, { count: count ?? data.length, data });
  }

  if (method === "POST") {
    const body = parseBody(req);
    if (!body) return sendJson(res, { error: "Invalid JSON body" }, 400);

    const count = Math.max(1, Math.min(Number(body.count || 1), 100));
    const prefix = body.prefix ? String(body.prefix).toUpperCase().slice(0, 8) : "TED";
    const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;

    const codes = Array.from({ length: count }, () => ({
      code: generateCode(prefix),
      expires_at: expiresAt,
    }));

    const { data, error } = await insertRow(
      "registration_codes",
      codes,
      "id,code,expires_at,created_at"
    );
    if (error) return sendJson(res, { error: "Failed to generate codes", detail: error }, 500);
    return sendJson(res, { count: data.length, data, createdBy: profile.email }, 201);
  }

  if (method === "DELETE") {
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const id = searchParams.get("id");
    if (!id) return sendJson(res, { error: "id query param is required" }, 400);

    const { data, error } = await deleteRow("registration_codes", "id", id);
    if (error) return sendJson(res, { error: "Failed to delete code", detail: error }, 500);
    if (!data || data.length === 0) return sendJson(res, { error: "Code not found" }, 404);
    return sendJson(res, { success: true, id });
  }

  return sendJson(res, { error: `Method ${method} not allowed` }, 405);
});
