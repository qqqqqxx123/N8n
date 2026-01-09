# How to Create Admin User

You have **3 options** to create the admin user. Choose the easiest one for you:

## Option 1: Direct SQL (Easiest - Recommended)

1. Open your Supabase SQL Editor
2. Copy and paste this SQL command:

```sql
-- Create admin user with password "admin123"
-- IMPORTANT: Change the password after first login!
INSERT INTO users (username, password_hash, full_name, email)
VALUES (
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',  -- bcrypt hash for "admin123"
  'Administrator',
  'admin@ringcrm.com'
) ON CONFLICT (username) DO NOTHING;
```

3. Click "Run" to execute
4. Login at `/login` with:
   - Username: `admin`
   - Password: `admin123`

**Note:** The password hash above is for password "admin123". If you want a different password, use Option 2 or 3 to generate a new hash.

---

## Option 2: Node.js Script (Generate Custom Password Hash)

1. Open terminal in the project directory
2. Run:
   ```bash
   node scripts/create-admin-user.js
   ```
3. The script will output a SQL command with your password hash
4. Copy the SQL command and run it in Supabase SQL Editor

**To change the password:** Edit `scripts/create-admin-user.js` and change the `password` variable, then run the script again.

---

## Option 3: Windows Batch File (API Method)

1. Make sure your Next.js server is running (`npm run dev`)
2. Double-click `create-admin-windows.bat` or run in Command Prompt:
   ```cmd
   create-admin-windows.bat
   ```

**Or use PowerShell (single line):**
```powershell
curl -X POST http://localhost:3000/api/auth/create-user -H "Content-Type: application/json" -d "{\"username\": \"admin\", \"password\": \"admin123\", \"full_name\": \"Administrator\", \"email\": \"admin@ringcrm.com\"}"
```

**Or use Command Prompt (single line):**
```cmd
curl -X POST http://localhost:3000/api/auth/create-user -H "Content-Type: application/json" -d "{\"username\": \"admin\", \"password\": \"admin123\", \"full_name\": \"Administrator\", \"email\": \"admin@ringcrm.com\"}"
```

---

## After Creating User

1. Go to `http://localhost:3000/login`
2. Login with:
   - Username: `admin`
   - Password: `admin123` (or whatever you set)
3. **IMPORTANT:** Change your password after first login!

---

## Troubleshooting

### "Internal server error" when using API
- Make sure your Next.js server is running
- Check that the database migration has been run
- Check server console for detailed error messages

### "Username already exists"
- The user already exists in the database
- You can either:
  - Use a different username
  - Delete the existing user and create again
  - Just login with existing credentials

### Can't connect to database
- Make sure Supabase is running
- Check your `.env` file has correct Supabase credentials
- Verify the migration `012_add_users_table.sql` has been executed


