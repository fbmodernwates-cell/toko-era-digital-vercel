// /api/admin/products
// GET    /api/admin/products              → list all admin_products
// POST   /api/admin/products             → create product { name, price, category?, stock?, description?, is_active? }
// DELETE /api/admin/products?id=<uuid>   → delete product by id
//
// Admin only.

const { adminClient } = require("../_lib/supabase");
const { withAdmin, json } = require("../_lib/auth");

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

  // ---------- GET: list products ----------
  if (method === "GET") {
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const isActive = searchParams.get("active");
    const limit = Math.min(Number(searchParams.get("limit") || "200"), 1000);

    let q = supabase
      .from("admin_products")
      .select("id, name, price, category, stock, description, is_active, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (isActive === "true") q = q.eq("is_active", true);
    if (isActive === "false") q = q.eq("is_active", false);

    const { data, error, count } = await q;
    if (error) return json({ error: "Failed to load products", detail: error.message }, 500);
    return json({ count: count ?? data.length, data });
  }

  // ---------- POST: create product ----------
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

    const { data, error } = await supabase
      .from("admin_products")
      .insert({ name, price, category, stock, description, is_active: isActive })
      .select()
      .single();

    if (error) return json({ error: "Failed to create product", detail: error.message }, 500);
    return json({ data, createdBy: profile.email }, 201);
  }

  // ---------- DELETE: remove product ----------
  if (method === "DELETE") {
    const { searchParams } = new URL(req.url || "", "http://localhost");
    const id = searchParams.get("id");
    if (!id) return json({ error: "id query param is required" }, 400);

    const { error, count } = await supabase.from("admin_products").delete().eq("id", id);
    if (error) return json({ error: "Failed to delete product", detail: error.message }, 500);
    if (count === 0) return json({ error: "Product not found" }, 404);
    return json({ success: true, id });
  }

  return json({ error: `Method ${method} not allowed` }, 405);
});
