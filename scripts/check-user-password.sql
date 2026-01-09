-- SQL to check user and generate new password hash if needed
-- 
-- Step 1: Check current user
SELECT id, username, password_hash, full_name, email, created_at 
FROM users 
WHERE username = 'admin';

-- Step 2: If password doesn't work, generate a new hash using:
--   node scripts/create-admin-user.js
-- Then update the user:
-- UPDATE users 
-- SET password_hash = '<new_hash_from_script>'
-- WHERE username = 'admin';

