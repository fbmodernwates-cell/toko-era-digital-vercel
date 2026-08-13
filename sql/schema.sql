-- ============================================
-- TOKO ERA DIGITAL - Database Schema
-- Jalankan di Supabase SQL Editor
-- ============================================
--
-- Catatan keamanan:
-- Policy admin menggunakan auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
-- BUKAN subquery ke auth.users (yang akan error "permission denied" atau
-- "infinite recursion" jika di-query dari policy di tabel profiles).
-- ============================================

-- 1. Tabel Profil
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'mitra',
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can view all" ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;

-- Recreate using auth.jwt() (NO recursion — does not query profiles/auth.users)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles" ON profiles
  FOR SELECT USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin', false)
  );

CREATE POLICY "Admin can update all profiles" ON profiles
  FOR UPDATE USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin', false)
  );

-- Trigger: buat profil otomatis saat daftar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Tabel Kode Pendaftaran
CREATE TABLE IF NOT EXISTS registration_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE registration_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access registration_codes" ON registration_codes;
DROP POLICY IF EXISTS "Admin full access" ON registration_codes;
DROP POLICY IF EXISTS "Anyone can read registration_codes" ON registration_codes;

CREATE POLICY "Anyone can read registration_codes" ON registration_codes
  FOR SELECT USING (true);

CREATE POLICY "Admin full access registration_codes" ON registration_codes
  FOR ALL USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin', false)
  );

-- 3. Tabel Produk Etalase (Admin)
CREATE TABLE IF NOT EXISTS admin_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  image_url TEXT,
  category TEXT,
  stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  -- Komisi untuk Sobat Era Digital yang berhasil menjual produk admin
  commission_type TEXT DEFAULT 'percent',     -- 'percent' | 'fixed'
  commission_percent NUMERIC(5,2) DEFAULT 0,  -- 0-100 percent
  commission_fixed NUMERIC DEFAULT 0,         -- fixed amount in Rp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access admin_products" ON admin_products;
DROP POLICY IF EXISTS "Admin full access products" ON admin_products;
DROP POLICY IF EXISTS "Anyone can read active admin_products" ON admin_products;
DROP POLICY IF EXISTS "Anyone can read active products" ON admin_products;

CREATE POLICY "Anyone can read active admin_products" ON admin_products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admin full access admin_products" ON admin_products
  FOR ALL USING (
    COALESCE((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin', false)
  );

-- 4. Tabel Produk User (Sobat Era Digital)
CREATE TABLE IF NOT EXISTS user_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  image_url TEXT,        -- URL gambar dari Supabase Storage
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own products" ON user_products
  FOR ALL USING (auth.uid() = user_id);

-- Anyone can view user_products (produk Sobat terlihat oleh semua Sobat)
DROP POLICY IF EXISTS "Anyone can view user_products" ON user_products;
CREATE POLICY "Anyone can view user_products" ON user_products
  FOR SELECT USING (true);

-- ============================================
-- STORAGE: product-images bucket
-- ============================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload product images" ON storage.objects;
CREATE POLICY "Users can upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Anyone can read product images" ON storage.objects;
CREATE POLICY "Anyone can read product images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Users can update their product images" ON storage.objects;
CREATE POLICY "Users can update their product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete their product images" ON storage.objects;
CREATE POLICY "Users can delete their product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 5. Tabel Toko
CREATE TABLE IF NOT EXISTS stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  store_name TEXT NOT NULL DEFAULT 'Toko Saya',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  slug TEXT UNIQUE,  -- short URL slug, e.g. 'budi-berkah' → /t/budi-berkah
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own store" ON stores
  FOR ALL USING (auth.uid() = user_id);

-- Anyone (anon + authenticated) can view active stores
DROP POLICY IF EXISTS "Anyone can view active stores" ON stores;
CREATE POLICY "Anyone can view active stores" ON stores
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Index for fast slug lookup
CREATE INDEX IF NOT EXISTS stores_slug_idx ON stores(slug) WHERE slug IS NOT NULL;

-- ============================================
-- RPC FUNCTION: get_sobat_count()
-- Public function untuk hitung jumlah Sobat Era Digital (termasuk admin)
-- Dipakai di homepage untuk counter real-time.
-- SECURITY DEFINER — bypass RLS, hanya return angka, tidak ekspos data.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_sobat_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM profiles;
$$;

GRANT EXECUTE ON FUNCTION public.get_sobat_count() TO anon, authenticated;

-- ============================================
-- RPC FUNCTION: get_seller_contact(uid)
-- Public — return phone + full_name + email for a seller
-- Used by public store page (/s/{userId} and /t/{slug}) to load
-- WhatsApp contact info without exposing private data.
-- SECURITY DEFINER — bypass RLS, only return public contact columns.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_seller_contact(uid UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_build_object(
    'phone', p.phone,
    'full_name', p.full_name,
    'email', p.email
  ), json_build_object()) AS contact
  FROM profiles p
  WHERE p.id = uid;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_contact(UUID) TO anon, authenticated;

-- ============================================
-- SELESAI! Jalankan di Supabase SQL Editor
-- ============================================
