const db = require('../config/db');

// GET /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const [[users]]        = await db.query('SELECT COUNT(*) AS total FROM users');
    const [[reports]]      = await db.query('SELECT COUNT(*) AS total FROM driver_reports');
    const [[pending]]      = await db.query("SELECT COUNT(*) AS total FROM driver_reports WHERE status = 'pending'");
    const [[calcs]]        = await db.query('SELECT COUNT(*) AS total FROM fare_calculations');
    const [[terminals]]    = await db.query('SELECT COUNT(*) AS total FROM terminals WHERE active = TRUE');
    const [[flagged]]      = await db.query('SELECT COUNT(*) AS total FROM tricycles WHERE flagged = TRUE');
    const [recentReports]  = await db.query(
      `SELECT dr.id, dr.body_number, dr.reported_fare, dr.calculated_fare, dr.overcharge_amount,
              dr.origin_name, dr.destination_name, dr.status, dr.reported_at,
              u.display_name, u.email
       FROM driver_reports dr JOIN users u ON u.id = dr.user_id
       ORDER BY dr.reported_at DESC LIMIT 5`
    );
    const [dailyReports7d] = await db.query(
      `SELECT DATE(reported_at) AS date, COUNT(*) AS count
       FROM driver_reports
       WHERE reported_at >= NOW() - INTERVAL 7 DAY
       GROUP BY DATE(reported_at)
       ORDER BY date`
    );
    res.json({
      total_users:     users.total,
      total_reports:   reports.total,
      pending_reports: pending.total,
      total_calcs:     calcs.total,
      active_terminals: terminals.total,
      flagged_tricycles: flagged.total,
      recent_reports: recentReports,
      daily_reports_7d: dailyReports7d,
    });
  } catch (err) { next(err); }
};

// GET /api/admin/reports?status=pending&page=1&limit=20
exports.getReports = async (req, res, next) => {
  try {
    const status = req.query.status || 'all';
    const page   = parseInt(req.query.page) || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const where  = status !== 'all' ? `WHERE dr.status = ${db.escape(status)}` : '';
    const [rows] = await db.query(
      `SELECT dr.id, dr.body_number, dr.reported_fare, dr.calculated_fare, dr.overcharge_amount,
              dr.origin_name, dr.destination_name, dr.distance_km, dr.passenger_count,
              dr.description, dr.status, dr.gps_validated, dr.reported_at,
              u.display_name, u.email
       FROM driver_reports dr JOIN users u ON u.id = dr.user_id
       ${where}
       ORDER BY dr.reported_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM driver_reports dr ${where}`
    );
    res.json({ reports: rows, total, page, limit });
  } catch (err) { next(err); }
};

// PATCH /api/admin/reports/:id/status
exports.updateReportStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending','approved','dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    await db.query('UPDATE driver_reports SET status = ? WHERE id = ?', [status, req.params.id]);
    await db.query('CALL RefreshTricycleFlags()');
    res.json({ message: 'Status updated.' });
  } catch (err) { next(err); }
};

// GET /api/admin/users?page=1&limit=20
exports.getUsers = async (req, res, next) => {
  try {
    const page   = parseInt(req.query.page) || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const [rows] = await db.query(
      `SELECT u.id, u.email, u.display_name, u.role, u.account_age, u.created_at,
              COUNT(DISTINCT dr.id) AS report_count,
              COUNT(DISTINCT fc.id) AS calc_count
       FROM users u
       LEFT JOIN driver_reports dr ON dr.user_id = u.id
       LEFT JOIN fare_calculations fc ON fc.user_id = u.id
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM users');
    res.json({ users: rows, total, page, limit });
  } catch (err) { next(err); }
};

// GET /api/admin/terminals
exports.getTerminals = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, COALESCE(ta.report_count, 0) AS reports_last_7d
       FROM terminals t
       LEFT JOIN terminal_alerts ta ON ta.terminal_id = t.id
       ORDER BY t.name`
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// POST /api/admin/terminals
exports.createTerminal = async (req, res, next) => {
  try {
    const { name, lat, lng, barangay, radius_m = 300 } = req.body;
    if (!name || !lat || !lng) return res.status(400).json({ error: 'name, lat, lng required.' });
    const [result] = await db.query(
      'INSERT INTO terminals (name, lat, lng, barangay, radius_m, active) VALUES (?, ?, ?, ?, ?, TRUE)',
      [name, lat, lng, barangay || null, radius_m]
    );
    res.status(201).json({ id: result.insertId, message: 'Terminal created.' });
  } catch (err) { next(err); }
};

// PUT /api/admin/terminals/:id
exports.updateTerminal = async (req, res, next) => {
  try {
    const { name, lat, lng, barangay, radius_m, active } = req.body;
    await db.query(
      'UPDATE terminals SET name=?, lat=?, lng=?, barangay=?, radius_m=?, active=? WHERE id=?',
      [name, lat, lng, barangay || null, radius_m, active !== false, req.params.id]
    );
    res.json({ message: 'Terminal updated.' });
  } catch (err) { next(err); }
};

// DELETE /api/admin/terminals/:id
exports.deleteTerminal = async (req, res, next) => {
  try {
    await db.query('UPDATE terminals SET active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'Terminal deactivated.' });
  } catch (err) { next(err); }
};

// PUT /api/admin/users/:id
exports.updateUser = async (req, res, next) => {
  try {
    const { display_name, role } = req.body;
    if (role && !['commuter', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    await db.query(
      'UPDATE users SET display_name = ?, role = ? WHERE id = ?',
      [display_name || null, role || 'commuter', req.params.id]
    );
    res.json({ message: 'User updated.' });
  } catch (err) { next(err); }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT role FROM users WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    if (rows[0].role === 'admin') return res.status(403).json({ error: 'Cannot delete admin accounts.' });
    // Delete related data first
    await db.query('DELETE FROM fare_calculations WHERE user_id = ?', [req.params.id]);
    await db.query('DELETE FROM driver_reports WHERE user_id = ?', [req.params.id]);
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deleted.' });
  } catch (err) { next(err); }
};

// GET /api/admin/ptro — list PTRO reports
exports.getPtroReports = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM ptro_reports ORDER BY sent_at DESC LIMIT 20'
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// POST /api/admin/ptro/trigger — manually generate & send weekly report
exports.triggerPtroReport = async (req, res, next) => {
  try {
    const ptroService = require('../services/ptro.service');
    await ptroService.generateAndSendWeeklyReport();
    res.json({ message: 'PTRO report generated and sent successfully.' });
  } catch (err) { next(err); }
};
