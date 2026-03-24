require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/db');

(async () => {
  const email = 'admin@taripa.app';
  const password = 'admin123';
  const display_name = 'Admin';
  const role = 'admin';

  const hash = await bcrypt.hash(password, 12);
  await db.query(
    'INSERT INTO users (email, password_hash, display_name, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE role = ?',
    [email, hash, display_name, role, role]
  );

  console.log('Admin seeded!');
  console.log('  Email:   ', email);
  console.log('  Password:', password);
  process.exit(0);
})();
