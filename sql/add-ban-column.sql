-- Add ban status to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- Allow admin to update ban status
CREATE POLICY IF NOT EXISTS "Admin can update ban status" ON profiles FOR UPDATE USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'));
