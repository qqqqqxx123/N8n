-- SQL command to create admin user
-- Replace the password_hash with a bcrypt hash of your desired password
-- 
-- To generate the password hash, you can:
-- 1. Use the Node.js script: node scripts/create-admin-user.js
-- 2. Or use an online bcrypt generator: https://bcrypt-generator.com/
-- 3. Or use the API endpoint (see below)

-- Example: Create admin user with password "admin123"
-- The hash below is for password "admin123" (bcrypt, 10 rounds)
INSERT INTO users (username, password_hash, full_name, email)
VALUES (
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',  -- This is bcrypt hash for "admin123"
  'Administrator',
  'admin@ringcrm.com'
) ON CONFLICT (username) DO NOTHING;

-- To create a user with a different password:
-- 1. Generate a bcrypt hash for your password (use one of the methods above)
-- 2. Replace the password_hash value in the INSERT statement above
-- 3. Run the SQL command in your Supabase SQL editor


