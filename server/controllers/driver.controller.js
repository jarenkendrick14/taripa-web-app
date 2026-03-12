const db = require('../config/db');

// GET /api/drivers/lookup/:bodyNumber
exports.lookupDriver = async (req, res, next) => {
  try {
    const bodyNumber = req.params.bodyNumber.trim().toUpperCase();

    // Get or create tricycle record
    let [tricycles] = await db.query(
      'SELECT * FROM tricycles WHERE body_number = ?',
      [bodyNumber]
    );

    if (!tricycles.length) {
      // First time this body number appears — create a record
      await db.query(
        'INSERT INTO tricycles (body_number) VALUES (?) ON DUPLICATE KEY UPDATE body_number = body_number',
        [bodyNumber]
      );
      [tricycles] = await db.query(
        'SELECT * FROM tricycles WHERE body_number = ?', [bodyNumber]
      );
    }

    const tricycle = tricycles[0];

    // Fetch 5 most recent reports for this body number
    const [recentReports] = await db.query(
      `SELECT dr.id, dr.reported_fare, dr.calculated_fare, dr.overcharge_amount,
              dr.origin_name, dr.destination_name, dr.distance_km, dr.reported_at,
              dr.description, dr.passenger_count
       FROM driver_reports dr
       WHERE dr.body_number = ? AND dr.status != 'dismissed'
       ORDER BY dr.reported_at DESC
       LIMIT 5`,
      [bodyNumber]
    );

    // Monthly stats
    const [stats] = await db.query(
      `SELECT
         COUNT(*) AS total_reports,
         SUM(overcharge_amount) AS total_overcharge,
         AVG(overcharge_amount) AS avg_overcharge,
         MAX(reported_at) AS last_reported
       FROM driver_reports
       WHERE body_number = ? AND reported_at >= NOW() - INTERVAL 30 DAY
         AND status != 'dismissed'`,
      [bodyNumber]
    );

    res.json({
      body_number:     tricycle.body_number,
      toda_name:       tricycle.toda_name,
      flagged:         tricycle.flagged,
      report_count_30d: tricycle.report_count_30d,
      stats:           stats[0],
      recent_reports:  recentReports,
    });
  } catch (err) { next(err); }
};

// GET /api/drivers/flagged — list all flagged tricycles
exports.getFlagged = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, COUNT(dr.id) AS total_lifetime_reports
       FROM tricycles t
       LEFT JOIN driver_reports dr ON dr.body_number = t.body_number
       WHERE t.flagged = TRUE
       GROUP BY t.id
       ORDER BY t.report_count_30d DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// GET /api/drivers/search?q=:query
exports.searchDrivers = async (req, res, next) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const [rows] = await db.query(
      `SELECT body_number, toda_name, flagged, report_count_30d
       FROM tricycles
       WHERE body_number LIKE ? OR toda_name LIKE ?
       ORDER BY flagged DESC, report_count_30d DESC
       LIMIT 20`,
      [q, q]
    );
    res.json(rows);
  } catch (err) { next(err); }
};
