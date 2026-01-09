/**
 * Simple Node.js script to create admin user
 * Run: node scripts/create-admin-user.js
 */

const bcrypt = require('bcryptjs');

// Change these values as needed
const username = 'admin';
const password = 'admin123'; // CHANGE THIS!
const fullName = 'Administrator';
const email = 'admin@ringcrm.com';

async function generateHash() {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    
    console.log('\n=== Admin User SQL Command ===\n');
    console.log(`INSERT INTO users (username, password_hash, full_name, email)`);
    console.log(`VALUES (`);
    console.log(`  '${username}',`);
    console.log(`  '${passwordHash}',`);
    console.log(`  '${fullName}',`);
    console.log(`  '${email}'`);
    console.log(`) ON CONFLICT (username) DO NOTHING;`);
    console.log('\n=== Copy and paste the above SQL into Supabase SQL Editor ===\n');
    console.log('Credentials:');
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    console.log(`  Full Name: ${fullName}`);
    console.log(`  Email: ${email}\n`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

generateHash();


