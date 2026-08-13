-- ============================================
-- SETUP ADMIN USER
-- Jalankan di Supabase SQL Editor
-- ============================================

-- Insert admin user ke auth.users
-- Password: admin123
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@tokodigital.id',
  crypt('admin123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Super Admin","role":"admin","phone":"6285123726941"}'
);

-- Insert juga ke profiles
INSERT INTO profiles (id, email, full_name, phone, role)
SELECT id, 'admin@tokodigital.id', 'Super Admin', '6285123726941', 'admin'
FROM auth.users WHERE email = 'admin@tokodigital.id'
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SELESAI!
-- Login: admin@tokodigital.id / admin123
-- ============================================
