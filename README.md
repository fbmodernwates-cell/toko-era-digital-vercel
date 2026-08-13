# Toko Era Digital

Multi-tenant e-commerce starter for **Toko Era Digital** — static HTML frontend + Vercel serverless API + Supabase backend.

## Arsitektur

```
Browser (HTML/JS)  ──►  Vercel (Static + /api/*)  ──►  Supabase (Postgres + Auth)
                            │
                            └─ /api/admin/* menggunakan SERVICE_ROLE_KEY
                               (bypass RLS, untuk operasi admin server-side)
```

- **Frontend**: HTML static (`index.html`, `login.html`, `register.html`, `admin.html`, `toko.html`) — pakai Supabase anon key dari client (sesuai RLS)
- **API**: Vercel serverless functions di `/api/*.js` — pakai service role key untuk operasi admin
- **Database**: Supabase Postgres dengan RLS policies (lihat `sql/schema.sql`)
- **Auth**: Supabase Auth (email/password + JWT)

## Quick start

### 1. Setup Supabase

1. Buat project baru di https://supabase.com
2. Buka SQL Editor → jalankan `sql/setup-all.sql` (atau `sql/schema.sql` lalu `sql/admin-setup.sql`)
3. Set admin role manual: jalankan `sql/ensure-admin.sql` (edit email Anda dulu)
4. Catat: **Project URL**, **anon key**, **service_role key** dari Project Settings → API

### 2. Deploy ke Vercel

1. Import repo ini ke Vercel
2. Tambahkan Environment Variables di Project Settings:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxxxxx
   ```
3. Deploy — Vercel otomatis detect static HTML + `/api/*.js` functions

### 3. Local development

```bash
# Install Vercel CLI
npm i -g vercel

# Pull env vars dari Vercel (atau buat .env manual dari .env.example)
vercel env pull .env.local

# Jalankan dev server (dengan /api/* functions aktif)
vercel dev
```

Buka http://localhost:3000 — semua route `/login`, `/register`, `/admin`, `/toko`, `/api-docs` sudah otomatis berfungsi via `vercel.json` rewrites.

## API Endpoints

Lihat dokumentasi lengkap di `/api-docs` setelah deploy, atau baca ringkasan di bawah.

### Public

| Method | Path           | Description                                  |
|--------|----------------|----------------------------------------------|
| GET    | `/api/health`  | Health check + env var status                 |

### Authenticated (Bearer token)

| Method | Path     | Description                                                    |
|--------|----------|----------------------------------------------------------------|
| GET    | `/api/me`| Profil user yang sedang login + store info (jika Sobat Era Digital)        |

### Admin only (`profiles.role = 'admin'`)

| Method  | Path                          | Description                                              |
|---------|-------------------------------|----------------------------------------------------------|
| GET     | `/api/admin/stats`            | Dashboard counts (users, codes, products, stores)        |
| GET     | `/api/admin/users`            | List profiles (`?role=&banned=&q=&limit=`)                |
| GET     | `/api/admin/products`         | List admin_products (`?active=&limit=`)                  |
| POST    | `/api/admin/products`         | Create product `{ name, price, category?, stock?, ... }` |
| DELETE  | `/api/admin/products?id=`     | Delete product by id                                      |
| GET     | `/api/admin/codes`            | List registration codes (`?used=&limit=`)                 |
| POST    | `/api/admin/codes`            | Generate codes `{ count?, prefix? }` — berlaku selamanya         |
| DELETE  | `/api/admin/codes?id=`        | Delete code by id                                         |
| POST    | `/api/admin/ban`              | Ban/unban user `{ userId, banned }`                       |
| POST    | `/api/admin/reset-password`   | Reset password user lain `{ userId, newPassword? }`       |

### Contoh request

```bash
# Get stats
curl https://your-domain.vercel.app/api/admin/stats \
  -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>"

# Generate 5 codes
curl -X POST https://your-domain.vercel.app/api/admin/codes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"count":5}'

# Reset password user lain (auto-generated)
curl -X POST https://your-domain.vercel.app/api/admin/reset-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"uuid-here"}'
```

## Struktur folder

```
.
├── api/                    # Vercel serverless functions
│   ├── _lib/
│   │   ├── supabase.js     # Supabase client factory (admin/anon)
│   │   └── auth.js         # JWT verification + withAdmin/withUser helpers
│   ├── health.js
│   ├── me.js
│   └── admin/
│       ├── stats.js
│       ├── users.js
│       ├── products.js
│       ├── codes.js
│       ├── ban.js
│       └── reset-password.js
├── js/
│   └── supabase-config.js  # Client-side Supabase (anon key only)
├── sql/
│   ├── schema.sql          # Tables: profiles, registration_codes, admin_products, user_products, stores
│   ├── admin-setup.sql     # RLS policies + admin role checks
│   ├── ensure-admin.sql    # Promote user jadi admin
│   ├── add-ban-column.sql
│   └── setup-all.sql       # Combined schema + policies
├── scripts/
│   ├── setup-env.sh        # Termux helper: store Vercel + Supabase tokens
│   ├── vercel-env.sh       # Wrapper to call vercel CLI with stored token
│   └── supabase-env.sh     # Wrapper to call supabase CLI with stored token
├── *.html                  # Frontend pages
├── .env.example
├── vercel.json
├── package.json
└── README.md
```

## Security

- ✅ **Anon key** (`SUPABASE_ANON_KEY`) — safe to expose in browser, controlled by RLS
- 🔒 **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`) — **server-side only**, never commit, never expose to browser. Used by `/api/admin/*` functions.
- 🔐 All `/api/admin/*` endpoints verify JWT dan cek `profiles.role = 'admin'` sebelum memproses.
- 🛡️ RLS policies aktif di semua tabel — bahkan jika anon key leak, data tetap aman.
- 🚫 `/api/admin/ban` menolak ban terhadap admin lain atau diri sendiri (anti-lockout).
- 🔑 `/api/admin/reset-password` generate password 16-char cryptographically secure (uses `crypto.randomBytes`).

## Setup admin pertama

Setelah registrasi user pertama via `/register`, promote jadi admin:

```sql
-- Di Supabase SQL Editor
UPDATE profiles
SET role = 'admin'
WHERE email = 'email.anda@example.com';
```

Atau jalankan `sql/ensure-admin.sql` setelah edit email-nya.

## Deployment checklist

- [ ] Supabase project dibuat, SQL schema dijalankan
- [ ] Vercel project dibuat dari repo ini
- [ ] 3 env vars di-set: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] User pertama di-promote jadi admin via SQL
- [ ] Test `/api/health` → harus return `"status":"ok"`
- [ ] Test login di `/login` → redirect ke `/admin` jika admin
- [ ] Cek dashboard stats di admin panel muncul
- [ ] Cek tombol "Reset Password" per user berfungsi

## License

MIT
