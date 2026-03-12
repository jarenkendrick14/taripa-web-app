const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { email, password, display_name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
      [email, hash, display_name || null]
    );

    const user = { id: result.insertId, email, role: 'commuter' };
    res.status(201).json({ token: signToken(user), user });
  } catch (err) { next(err); }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query(
      'SELECT id, email, password_hash, display_name, role, account_age FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Update account_age in background
    db.query(
      'UPDATE users SET account_age = DATEDIFF(NOW(), created_at) WHERE id = ?',
      [user.id]
    );

    const { password_hash, ...safeUser } = user;
    res.json({ token: signToken(user), user: safeUser });
  } catch (err) { next(err); }
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, email, display_name, role, account_age, trusted_contact_name, trusted_contact_phone, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

// PATCH /api/auth/trusted-contact
exports.updateTrustedContact = async (req, res, next) => {
  try {
    const { trusted_contact_name, trusted_contact_phone } = req.body;
    await db.query(
      'UPDATE users SET trusted_contact_name = ?, trusted_contact_phone = ? WHERE id = ?',
      [trusted_contact_name, trusted_contact_phone, req.user.id]
    );
    res.json({ message: 'Trusted contact updated.' });
  } catch (err) { next(err); }
};
