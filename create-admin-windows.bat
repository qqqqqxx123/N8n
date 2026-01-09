@echo off
REM Windows batch file to create admin user via API
REM Make sure your Next.js server is running on http://localhost:3000

curl -X POST http://localhost:3000/api/auth/create-user ^
  -H "Content-Type: application/json" ^
  -d "{\"username\": \"admin\", \"password\": \"admin123\", \"full_name\": \"Administrator\", \"email\": \"admin@ringcrm.com\"}"

pause

