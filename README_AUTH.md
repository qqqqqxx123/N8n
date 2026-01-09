# Authentication Setup Guide

This CRM now includes authentication with login/logout functionality.

## Database Setup

1. Run the migration to create users and sessions tables:
   ```sql
   -- Run the migration file:
   supabase/migrations/012_add_users_table.sql
   ```

## Creating the First Admin User

You have two options to create the first admin user:

### Option 1: Using the API Endpoint (Recommended)

Make a POST request to `/api/auth/create-user`:

```bash
curl -X POST http://localhost:3000/api/auth/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "full_name": "Administrator",
    "email": "admin@ringcrm.com"
  }'
```

**Important**: Change the password after first login!

### Option 2: Using the Script

Run the script to generate a password hash:

```bash
npx tsx scripts/create-admin-user.ts
```

Then use the generated hash in a SQL query:

```sql
INSERT INTO users (username, password_hash, full_name, email)
VALUES ('admin', '<generated_hash>', 'Administrator', 'admin@ringcrm.com');
```

## Login

1. Navigate to `/login`
2. Enter your username and password
3. You'll be redirected to the home page upon successful login

## Logout

Click the "Logout" button in the navbar to end your session.

## Session Management

- Sessions are stored in the `sessions` table in Supabase
- Sessions expire after 30 days
- Session tokens are stored in HTTP-only cookies for security
- The middleware automatically protects all routes except `/login` and `/api/auth/*`

## Protected Routes

All routes are protected by default. The following routes are publicly accessible:
- `/login` - Login page
- `/api/auth/*` - Authentication API endpoints
- `/api/whatsapp/webhook/*` - WhatsApp webhooks (use API keys)
- `/api/webhooks/*` - Generic webhooks (use API keys)
- `/api/n8n/*` - N8N integration endpoints

## Security Notes

1. **Change default passwords**: Always change the default admin password after first setup
2. **Password hashing**: Passwords are hashed using bcrypt with 10 rounds
3. **Session tokens**: Session tokens are cryptographically random (32 bytes hex)
4. **HTTP-only cookies**: Session tokens are stored in HTTP-only cookies to prevent XSS attacks
5. **Session expiration**: Sessions automatically expire after 30 days

## API Endpoints

### POST `/api/auth/login`
Login with username and password.

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "...",
    "username": "admin",
    "full_name": "Administrator",
    "email": "admin@ringcrm.com"
  }
}
```

### POST `/api/auth/logout`
Logout and clear session.

**Response:**
```json
{
  "success": true
}
```

### GET `/api/auth/session`
Check current session status.

**Response:**
```json
{
  "user": {
    "id": "...",
    "username": "admin",
    "full_name": "Administrator",
    "email": "admin@ringcrm.com"
  }
}
```

If not logged in:
```json
{
  "user": null
}
```


