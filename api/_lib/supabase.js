// Lightweight Supabase REST client using native fetch.
// No @supabase/supabase-js dependency → fast cold start on Vercel.
//
// This module exposes the same admin operations we need:
//   - getUserByAccessToken(token)   → verify caller's JWT
//   - getProfile(userId)            → load profiles row
//   - listProfiles(opts)            → list with filters
//   - updateProfile(userId, fields) → patch profiles row
//   - adminUpdateUserById(userId, attrs) → Auth Admin API (e.g. reset password)
//   - listTable(name, opts)         → generic list
//   - insertRow(name, rows)         → generic insert
//   - deleteRow(name, filter)       → generic delete
//   - countRows(name)               → head count

function getEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env var: ${name}. Set it in Vercel Project Settings → Environment Variables.`
    );
  }
  return v;
}

function baseUrl() {
  return getEnv("SUPABASE_URL").replace(/\/$/, "");
}

function serviceRoleKey() {
  return getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function anonKey() {
  // Prefer SUPABASE_ANON_KEY, fall back to SUPABASE_PUBLISHABLE_KEY
  return process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || getEnv("SUPABASE_ANON_KEY");
}

/**
 * Common headers for service-role REST calls.
 */
function adminHeaders() {
  const key = serviceRoleKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

/**
 * Verify an access token (JWT) via the GoTrue admin endpoint.
 * Returns { user, error }.
 */
async function getUserByAccessToken(accessToken) {
  const url = `${baseUrl()}/auth/v1/user`;
  const res = await fetch(url, {
    headers: {
      apikey: anonKey(),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    return { user: null, error: `Failed to verify token: ${res.status} ${text}` };
  }
  const user = await res.json();
  return { user, error: null };
}

/**
 * Load a single profile by user id.
 */
async function getProfile(userId) {
  const url = `${baseUrl()}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,full_name,phone,role,is_banned,created_at`;
  const res = await fetch(url, { headers: adminHeaders() });
  if (!res.ok) {
    const text = await res.text();
    return { data: null, error: `Failed to load profile: ${res.status} ${text}` };
  }
  const arr = await res.json();
  return { data: arr && arr.length > 0 ? arr[0] : null, error: null };
}

/**
 * Update a profile row by user id.
 */
async function updateProfile(userId, fields) {
  const url = `${baseUrl()}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const text = await res.text();
    return { data: null, error: `Failed to update profile: ${res.status} ${text}` };
  }
  const arr = await res.json();
  return { data: arr && arr.length > 0 ? arr[0] : null, error: null };
}

/**
 * List profiles with optional filters.
 *   - role: string
 *   - banned: boolean
 *   - q: string (case-insensitive search on email OR full_name)
 *   - limit: number (default 100, max 1000)
 */
async function listProfiles(opts = {}) {
  const limit = Math.min(Number(opts.limit || 100), 1000);
  const params = new URLSearchParams();
  params.set("select", "id,email,full_name,phone,role,is_banned,created_at");
  params.set("limit", String(limit));
  params.set("order", "created_at.desc");

  let url = `${baseUrl()}/rest/v1/profiles?${params.toString()}`;
  if (opts.role) url += `&role=eq.${encodeURIComponent(opts.role)}`;
  if (opts.banned === true) url += `&is_banned=eq.true`;
  if (opts.banned === false) url += `&is_banned=eq.false`;
  if (opts.q) {
    // OR filter: email ILIKE %q% OR full_name ILIKE %q%
    const q = encodeURIComponent(`%${opts.q}%`);
    url += `&or=(email.ilike.${q},full_name.ilike.${q})`;
  }

  const res = await fetch(url, {
    headers: { ...adminHeaders(), Prefer: "count=exact" },
  });
  if (!res.ok) {
    const text = await res.text();
    return { data: null, error: `Failed to list profiles: ${res.status} ${text}`, count: 0 };
  }
  const data = await res.json();
  const count = Number(res.headers.get("content-range")?.split("/")[1] || data.length);
  return { data, error: null, count };
}

/**
 * Auth Admin API: update user attributes (e.g. password).
 */
async function adminUpdateUserById(userId, attrs) {
  const url = `${baseUrl()}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify(attrs),
  });
  if (!res.ok) {
    const text = await res.text();
    return { data: null, error: `Auth admin update failed: ${res.status} ${text}` };
  }
  const data = await res.json();
  return { data, error: null };
}

/**
 * Auth Admin API: get user by id (verify user exists).
 */
async function adminGetUserById(userId) {
  const url = `${baseUrl()}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
  const res = await fetch(url, { headers: adminHeaders() });
  if (!res.ok) {
    return { data: null, error: `User not found: ${res.status}` };
  }
  const data = await res.json();
  return { data, error: null };
}

/**
 * Generic list helper for tables.
 */
async function listTable(name, opts = {}) {
  const limit = Math.min(Number(opts.limit || 100), 1000);
  const params = new URLSearchParams();
  if (opts.select) params.set("select", opts.select);
  params.set("limit", String(limit));
  if (opts.order) params.set("order", opts.order);

  let url = `${baseUrl()}/rest/v1/${encodeURIComponent(name)}?${params.toString()}`;
  for (const [col, val] of Object.entries(opts.eq || {})) {
    url += `&${col}=eq.${encodeURIComponent(val)}`;
  }

  const res = await fetch(url, {
    headers: { ...adminHeaders(), Prefer: "count=exact" },
  });
  if (!res.ok) {
    const text = await res.text();
    return { data: null, error: `Failed to list ${name}: ${res.status} ${text}`, count: 0 };
  }
  const data = await res.json();
  const count = Number(res.headers.get("content-range")?.split("/")[1] || data.length);
  return { data, error: null, count };
}

/**
 * Generic insert helper.
 */
async function insertRow(name, rows, select = "*") {
  const url = `${baseUrl()}/rest/v1/${encodeURIComponent(name)}?select=${encodeURIComponent(select)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    return { data: null, error: `Failed to insert into ${name}: ${res.status} ${text}` };
  }
  const data = await res.json();
  return { data, error: null };
}

/**
 * Generic delete helper (filter by single column = value).
 */
async function deleteRow(name, filterCol, filterVal) {
  const url = `${baseUrl()}/rest/v1/${encodeURIComponent(name)}?${filterCol}=eq.${encodeURIComponent(filterVal)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { ...adminHeaders(), Prefer: "return=representation" },
  });
  if (!res.ok) {
    const text = await res.text();
    return { data: null, error: `Failed to delete from ${name}: ${res.status} ${text}` };
  }
  const data = await res.json();
  return { data, error: null };
}

/**
 * Count rows in a table (head request).
 */
async function countRows(name, filter = "") {
  const url = `${baseUrl()}/rest/v1/${encodeURIComponent(name)}?${filter}`;
  const res = await fetch(url, {
    method: "HEAD",
    headers: { ...adminHeaders(), Prefer: "count=exact" },
  });
  if (!res.ok) return { count: 0, error: `Failed to count ${name}: ${res.status}` };
  const count = Number(res.headers.get("content-range")?.split("/")[1] || 0);
  return { count, error: null };
}

module.exports = {
  baseUrl,
  adminHeaders,
  getUserByAccessToken,
  getProfile,
  updateProfile,
  listProfiles,
  adminUpdateUserById,
  adminGetUserById,
  listTable,
  insertRow,
  deleteRow,
  countRows,
};
