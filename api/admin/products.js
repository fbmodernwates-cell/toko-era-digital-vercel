// /api/admin/products
// GET    /api/admin/products              → list all admin_products
// POST   /api/admin/products             → create product
// DELETE /api/admin/products?id=<uuid>   → delete product by id

const {
  listTable,
  insertRow,
  deleteRow,
} = require("../_lib/supabase");
const { withAdmin, json } = require("../_lib/auth");

function parseBody(req) {
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return null;
  }
}

module.exports = withAdmin(async ({ req, profile }) => {
  const method = (req.method || "GET").toUpperCase();

  // GET: list
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
    if (error) return json({ error: "Failed to load products", detail: error }, 500);
    return json({ count: count ?? data.length, data });
  }

  // POST: create
  if (method === "POST") {
    const body = parseBody(req);
    if (!body) return json({ error: "Invalid JSON body" }, 400);

    const name = String(body.name || "").trim();
    const price = Number(body.price);
    const category = body.category ? String(body.category).trim() : null;
    const stock = body.stock != null ? Number(body.stock) : 0;
    const description = body.description ? String(body.description).trim() : null;
    const isActive = body.is_active != null ? Boolean(body.is_active) : true;

    if (!name) return json({ error: "name is required" }, 400);
    if (Number.isNaN(price) || price < 0) return json({ error: "price must be a non-negative number" }, 400);

    const { data, error } = await insertRow(
      "admin_products",
      { name, price, category, stock, description, is_active: isActive },
      "id,name,price,category,stock,description,is_active,created_at"
    );
    if (error) return json({ error: "Failed to create product", detail: error }, 500);
    return json({ data: data && data[0], createdBy: profile.email }, 201);
  }

  // DELETE
  if (method === "DELETE") {
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const id = searchParams.get("id");
    if (!id) return json({ error: "id query param is required" }, 400);

    const { data, error } = await deleteRow("admin_products", "id", id);
    if (error) return json({ error: "Failed to delete product", detail: error }, 500);
    if (!data || data.length === 0) return json({ error: "Product not found" }, 404);
    return json({ success: true, id });
  }

  return json({ error: `Method ${method} not allowed` }, 405);
});
