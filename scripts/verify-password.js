/**
 * Script to verify if a password matches a hash
 * Usage: node scripts/verify-password.js <password> <hash>
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2];
const hash = process.argv[3];

if (!password || !hash) {
  console.error('Usage: node scripts/verify-password.js <password> <hash>');
  process.exit(1);
}

async function verify() {
  try {
    const isValid = await bcrypt.compare(password, hash);
    console.log('Password match:', isValid);
    if (!isValid) {
      console.log('\nThe password does NOT match the hash.');
      console.log('You may need to update the password hash in the database.');
    } else {
      console.log('\n✓ Password matches the hash!');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verify();

