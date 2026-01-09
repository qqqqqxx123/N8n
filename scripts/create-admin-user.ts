/**
 * Script to create the initial admin user
 * Run this once after setting up the database to create the default admin user
 * 
 * Usage: npx tsx scripts/create-admin-user.ts
 * Or: node -r ts-node/register scripts/create-admin-user.ts
 */

import bcrypt from 'bcryptjs';

// Generate a password hash for the admin user
// Replace 'admin123' with your desired password
const username = 'admin';
const password = 'admin123'; // Change this!
const fullName = 'Administrator';
const email = 'admin@ringcrm.com';

async function createAdminUser() {
  try {
    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);
    
    console.log('Admin user credentials:');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log(`Full Name: ${fullName}`);
    console.log(`Email: ${email}`);
    console.log('\nPassword hash (bcrypt):');
    console.log(passwordHash);
    console.log('\nYou can now use this hash in a SQL query:');
    console.log(`INSERT INTO users (username, password_hash, full_name, email)`);
    console.log(`VALUES ('${username}', '${passwordHash}', '${fullName}', '${email}');`);
    console.log('\nOr use the API endpoint:');
    console.log(`POST /api/auth/create-user`);
    console.log(`Body: { "username": "${username}", "password": "${password}", "full_name": "${fullName}", "email": "${email}" }`);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();

