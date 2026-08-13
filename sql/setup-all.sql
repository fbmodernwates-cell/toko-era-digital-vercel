-- ============================================
-- TOKO ERA DIGITAL - Setup All (Combined)
-- One-shot setup: tables + RLS policies + admin trigger
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

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can view all" ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin via JWT user_metadata.role (no recursion)
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
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own products" ON user_products
  FOR ALL USING (auth.uid() = user_id);

-- 5. Tabel Toko
CREATE TABLE IF NOT EXISTS stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  store_name TEXT NOT NULL DEFAULT 'Toko Saya',
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own store" ON stores
  FOR ALL USING (auth.uid() = user_id);
