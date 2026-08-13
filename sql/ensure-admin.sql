-- ============================================
-- TOKO ERA DIGITAL - Ensure Admin Account
-- Jalankan di Supabase SQL Editor
-- ============================================

-- 1. Pastikan kolom role dan is_banned ada di profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'mitra';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- 2. Buat admin user di auth.users
-- Catatan: Ini akan membuat user dengan password 'admin123'
-- Ganti password setelah login pertama
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed, confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
  gen_random_uuid(),
  'admin@tokodigital.id',
  crypt('admin123', gen_salt('bf', 10)),
  true,
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Administrator","phone":"","role":"admin"}'::jsonb,
  'authenticated',
  'authenticated'
)
ON CONFLICT (email) DO NOTHING;

-- 3. Buat profile admin
INSERT INTO profiles (id, email, full_name, phone, role, is_banned, created_at)
SELECT id, email, 'Administrator', '', 'admin', false, now()
FROM auth.users
WHERE email = 'admin@tokodigital.id'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  is_banned = false;

-- 4. Berikan akses penuh ke admin untuk semua tabel
-- Profiles
DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
CREATE POLICY "Admin full access profiles" ON profiles FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
);

-- Registration codes
DROP POLICY IF EXISTS "Admin full access registration_codes" ON registration_codes;
CREATE POLICY "Admin full access registration_codes" ON registration_codes FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
);

-- Admin products
DROP POLICY IF EXISTS "Admin full access admin_products" ON admin_products;
CREATE POLICY "Admin full access admin_products" ON admin_products FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
);

-- User products
DROP POLICY IF EXISTS "Admin full access user_products" ON user_products;
CREATE POLICY "Admin full access user_products" ON user_products FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
);

-- Stores
DROP POLICY IF EXISTS "Admin full access stores" ON stores;
CREATE POLICY "Admin full access stores" ON stores FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin')
);

-- 5. Verifikasi
SELECT 
  u.email,
  p.role,
  p.is_banned
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE u.email = 'admin@tokodigital.id';

-- ============================================
-- SELESAI! Setelah menjalankan SQL ini:
-- 1. Login di https://toko-era-digital-vercel.vercel.app/login.html
-- 2. Email: admin@tokodigital.id
-- 3. Password: admin123
-- 4. Akan otomatis redirect ke /admin.html
-- 5. Ganti password segera via halaman admin
-- ============================================
