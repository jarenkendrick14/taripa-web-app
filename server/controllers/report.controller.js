const db = require('../config/db');
const { refreshTricycleFlag } = require('../services/tricycle-flags.service');

const GPS_VALIDATION_RADIUS_M = 500; // User must be within 500m of origin to validate report

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// POST /api/reports/submit
exports.submitReport = async (req, res, next) => {
  try {
    const {
      body_number, reported_fare, calculated_fare,
      origin_lat, origin_lng, destination_lat, destination_lng,
      origin_name, destination_name, distance_km,
      passenger_count = 1, description,
      user_current_lat, user_current_lng,   // for GPS proximity validation
    } = req.body;

    if (!body_number || !reported_fare || !calculated_fare) {
      return res.status(400).json({ error: 'body_number, reported_fare, and calculated_fare are required.' });
    }
    if (parseFloat(reported_fare) <= parseFloat(calculated_fare)) {
      return res.status(400).json({ error: 'Reported fare must be higher than the legal fare to submit an overcharge report.' });
    }

    // GPS proximity validation (soft — just a flag, not a blocker)
    let gpsValidated = false;
    if (user_current_lat && origin_lat) {
      const dist = haversineM(
        parseFloat(user_current_lat), parseFloat(user_current_lng),
        parseFloat(origin_lat), parseFloat(origin_lng)
      );
      gpsValidated = dist <= GPS_VALIDATION_RADIUS_M;
    }

    // Ensure tricycle record exists
    await db.query(
      'INSERT INTO tricycles (body_number) VALUES (?) ON DUPLICATE KEY UPDATE body_number = body_number',
      [body_number.trim().toUpperCase()]
    );
    const [trikRows] = await db.query(
      'SELECT id FROM tricycles WHERE body_number = ?',
      [body_number.trim().toUpperCase()]
    );
    const tricycleId = trikRows[0]?.id || null;

    const [result] = await db.query(
      `INSERT INTO driver_reports
         (user_id, body_number, tricycle_id, reported_fare, calculated_fare,
          origin_lat, origin_lng, destination_lat, destination_lng,
          origin_name, destination_name, distance_km,
          passenger_count, description, gps_validated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        body_number.trim().toUpperCase(),
        tricycleId,
        parseFloat(reported_fare),
        parseFloat(calculated_fare),
        origin_lat || null,
        origin_lng || null,
        destination_lat || null,
        destination_lng || null,
        origin_name || null,
        destination_name || null,
        distance_km ? parseFloat(distance_km) : null,
        parseInt(passenger_count),
        description || null,
        gpsValidated,
      ]
    );

    try {
      await refreshTricycleFlag(body_number.trim().toUpperCase());
    } catch (refreshErr) {
      console.error('[REPORT SUBMIT] Failed to refresh tricycle flag:', refreshErr.message);
    }

    res.status(201).json({
      report_id:    result.insertId,
      gps_validated: gpsValidated,
      message: 'Report submitted successfully. Thank you for keeping fares fair!',
    });
  } catch (err) { next(err); }
};

// GET /api/reports/my — authenticated user's own reports
exports.getMyReports = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, body_number, reported_fare, calculated_fare, overcharge_amount,
              origin_name, destination_name, distance_km, status, reported_at
       FROM driver_reports WHERE user_id = ?
       ORDER BY reported_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// POST /api/reports/safe-ride
exports.logSafeRide = async (req, res, next) => {
  try {
    const {
      body_number,
      origin_lat, origin_lng, destination_lat, destination_lng,
      origin_name, destination_name,
      trusted_contact_name, trusted_contact_phone,
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO safe_ride_logs
         (user_id, body_number, origin_lat, origin_lng,
          destination_lat, destination_lng, origin_name, destination_name,
          trusted_contact_name, trusted_contact_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        body_number || null,
        origin_lat || null, origin_lng || null,
        destination_lat || null, destination_lng || null,
        origin_name || null, destination_name || null,
        trusted_contact_name || null,
        trusted_contact_phone || null,
      ]
    );

    res.status(201).json({ log_id: result.insertId, message: 'Safe ride share logged.' });
  } catch (err) { next(err); }
};

// GET /api/reports/admin/pending — admin only
exports.getPendingReports = async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `SELECT dr.*, u.display_name, u.email
       FROM driver_reports dr
       JOIN users u ON u.id = dr.user_id
       WHERE dr.status = 'pending'
       ORDER BY dr.reported_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) AS total FROM driver_reports WHERE status = 'pending'"
    );

    res.json({ reports: rows, total, page, limit });
  } catch (err) { next(err); }
};
