// /api/admin/products
// GET    /api/admin/products
// POST   /api/admin/products
// DELETE /api/admin/products?id=<uuid>

const { listTable, insertRow, deleteRow } = require("../_lib/supabase");
const { withAdmin, sendJson, parseJsonBody } = require("../_lib/auth");

module.exports = withAdmin(async ({ req, res, profile }) => {
  const method = (req.method || "GET").toUpperCase();

  if (method === "GET") {
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const isActive = searchParams.get("active");
    const limit = Math.min(Number(searchParams.get("limit") || "200"), 1000);

    const opts = {
      select: "id,name,price,category,stock,description,is_active,created_at",
      order: "created_at.desc",
      limit,
    };
    if (isActive === "true") opts.eq = { is_active: true };
    if (isActive === "false") opts.eq = { is_active: false };

    const { data, error, count } = await listTable("admin_products", opts);
    if (error) return sendJson(res, { error: "Failed to load products", detail: error }, 500);
    return sendJson(res, { count: count ?? data.length, data });
  }

  if (method === "POST") {
    const body = parseJsonBody(req);
    if (!body) return sendJson(res, { error: "Invalid JSON body" }, 400);

    const name = String(body.name || "").trim();
    const price = Number(body.price);
    const category = body.category ? String(body.category).trim() : null;
    const stock = body.stock != null ? Number(body.stock) : 0;
    const description = body.description ? String(body.description).trim() : null;
    const isActive = body.is_active != null ? Boolean(body.is_active) : true;

    if (!name) return sendJson(res, { error: "name is required" }, 400);
    if (Number.isNaN(price) || price < 0) return sendJson(res, { error: "price must be a non-negative number" }, 400);

    const { data, error } = await insertRow(
      "admin_products",
      { name, price, category, stock, description, is_active: isActive },
      "id,name,price,category,stock,description,is_active,created_at"
    );
    if (error) return sendJson(res, { error: "Failed to create product", detail: error }, 500);
    return sendJson(res, { data: data && data[0], createdBy: profile.email }, 201);
  }

  if (method === "DELETE") {
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const id = searchParams.get("id");
    if (!id) return sendJson(res, { error: "id query param is required" }, 400);

    const { data, error } = await deleteRow("admin_products", "id", id);
    if (error) return sendJson(res, { error: "Failed to delete product", detail: error }, 500);
    if (!data || data.length === 0) return sendJson(res, { error: "Product not found" }, 404);
    return sendJson(res, { success: true, id });
  }

  return sendJson(res, { error: `Method ${method} not allowed` }, 405);
});
