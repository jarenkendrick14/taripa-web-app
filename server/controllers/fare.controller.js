const db = require('../config/db');

/**
 * Haversine formula — returns distance in km between two GPS coords.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R  = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Computes the exact change breakdown for Tamang Sukli.
 * Returns fewest bills/coins needed.
 */
function computeExactChange(amount) {
  const denominations = [1000, 500, 200, 100, 50, 20, 10, 5, 1];
  let remaining = Math.round(amount);
  const breakdown = [];
  for (const denom of denominations) {
    const count = Math.floor(remaining / denom);
    if (count > 0) breakdown.push({ denom, count });
    remaining %= denom;
  }
  return breakdown;
}

// GET /api/fare/ordinance?lgu=Angeles+City
exports.getOrdinance = async (req, res, next) => {
  try {
    const lgu = req.query.lgu || 'Angeles City';
    const [rows] = await db.query(
      'SELECT * FROM fare_ordinances WHERE lgu = ? AND is_active = TRUE ORDER BY passenger_type',
      [lgu]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// POST /api/fare/calculate
// Body: { origin_lat, origin_lng, dest_lat, dest_lng, passenger_type, origin_name, dest_name }
exports.calculateFare = async (req, res, next) => {
  try {
    const {
      origin_lat, origin_lng,
      dest_lat, dest_lng,
      passenger_type = 'regular',
      origin_name, dest_name,
      road_distance_km,
    } = req.body;

    if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) {
      return res.status(400).json({ error: 'GPS coordinates are required.' });
    }

    // solo_parent gets the same discounted rate as pwd (Ordinance No. 723)
    const lookupType = passenger_type === 'solo_parent' ? 'pwd' : passenger_type;

    // Get active ordinance for passenger type
    const [ordinances] = await db.query(
      'SELECT * FROM fare_ordinances WHERE lgu = ? AND is_active = TRUE AND passenger_type = ? LIMIT 1',
      ['Angeles City', lookupType]
    );
    if (!ordinances.length) {
      return res.status(404).json({ error: 'No active ordinance found.' });
    }

    const ord = ordinances[0];
    // Use OSRM road distance if provided by the client, fall back to haversine
    const distanceKm = road_distance_km
      ? parseFloat(road_distance_km)
      : haversineKm(
          parseFloat(origin_lat), parseFloat(origin_lng),
          parseFloat(dest_lat),   parseFloat(dest_lng)
        );

    // mysql2 returns DECIMAL columns as strings — parse them first
    const baseFare  = parseFloat(ord.base_fare);
    const perKmRate = parseFloat(ord.per_km_rate);
    const minFare   = parseFloat(ord.min_fare);

    // Ordinance No. 723: ₱35 base covers first km, +₱15 per succeeding km (ceiling)
    const succeedingKm = distanceKm > 1 ? Math.ceil(distanceKm - 1) : 0;
    const rawFare      = baseFare + (perKmRate * succeedingKm);
    const computedFare = Math.max(minFare, Math.round(rawFare));
    const exactChange  = computeExactChange(computedFare);

    // For discounted passengers, compute what the regular fare would have been
    let regularFare    = null;
    let discountAmount = null;
    if (passenger_type !== 'regular') {
      const [regOrds] = await db.query(
        'SELECT * FROM fare_ordinances WHERE lgu = ? AND is_active = TRUE AND passenger_type = ? LIMIT 1',
        ['Angeles City', 'regular']
      );
      if (regOrds.length) {
        const r        = regOrds[0];
        const regBase  = parseFloat(r.base_fare);
        const regPerKm = parseFloat(r.per_km_rate);
        const regMin   = parseFloat(r.min_fare);
        const regRaw   = regBase + (regPerKm * succeedingKm);
        regularFare    = Math.max(regMin, Math.round(regRaw));
        discountAmount = regularFare - computedFare;
      }
    }

    // Log the calculation
    const userId = req.user?.id || null;
    const [logResult] = await db.query(
      `INSERT INTO fare_calculations
       (user_id, ordinance_id, passenger_type, origin_lat, origin_lng,
        dest_lat, dest_lng, origin_name, dest_name, distance_km, computed_fare)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, ord.id, passenger_type,
       origin_lat, origin_lng, dest_lat, dest_lng,
       origin_name || null, dest_name || null,
       distanceKm.toFixed(3), computedFare]
    );

    res.json({
      calculation_id:  logResult.insertId,
      ordinance_no:    ord.ordinance_no,
      lgu:             ord.lgu,
      passenger_type,
      distance_km:     parseFloat(distanceKm.toFixed(3)),
      succeeding_km:   succeedingKm,
      base_fare:       baseFare,
      per_km_rate:     perKmRate,
      computed_fare:   computedFare,
      regular_fare:    regularFare,
      discount_amount: discountAmount,
      exact_change:    exactChange,
      origin_name:     origin_name || 'Origin',
      dest_name:       dest_name   || 'Destination',
      ordinance_cite:  `Ordinance ${ord.ordinance_no} — ${ord.lgu}`,
      generated_at:    new Date().toISOString(),
    });
  } catch (err) { next(err); }
};

// POST /api/fare/resibo/:calculationId — mark resibo as shown
exports.markResiboGenerated = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE fare_calculations SET resibo_generated = TRUE WHERE id = ?',
      [req.params.calculationId]
    );
    res.json({ message: 'Resibo marked as generated.' });
  } catch (err) { next(err); }
};

// GET /api/fare/terminals — for Bantay Batas GPS alerts
exports.getTerminals = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, COALESCE(ta.report_count, 0) AS reports_last_7d
       FROM terminals t
       LEFT JOIN terminal_alerts ta ON ta.terminal_id = t.id
       WHERE t.active = TRUE
       ORDER BY reports_last_7d DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// GET /api/fare/my-history
exports.getMyHistory = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT id, passenger_type, origin_name, dest_name, distance_km, computed_fare, resibo_generated, created_at
       FROM fare_calculations WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};
