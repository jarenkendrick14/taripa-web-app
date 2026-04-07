const db = require('../config/db');

async function refreshAllTricycleFlags() {
  await db.query(`
    UPDATE tricycles t
    LEFT JOIN (
      SELECT body_number, COUNT(*) AS cnt
      FROM driver_reports
      WHERE reported_at >= NOW() - INTERVAL 30 DAY
      GROUP BY body_number
    ) r ON t.body_number = r.body_number
    SET t.report_count_30d = COALESCE(r.cnt, 0),
        t.flagged = (COALESCE(r.cnt, 0) >= 5)
  `);
}

async function refreshTricycleFlag(bodyNumber) {
  await db.query(
    `
      UPDATE tricycles t
      LEFT JOIN (
        SELECT body_number, COUNT(*) AS cnt
        FROM driver_reports
        WHERE body_number = ?
          AND reported_at >= NOW() - INTERVAL 30 DAY
        GROUP BY body_number
      ) r ON t.body_number = r.body_number
      SET t.report_count_30d = COALESCE(r.cnt, 0),
          t.flagged = (COALESCE(r.cnt, 0) >= 5)
      WHERE t.body_number = ?
    `,
    [bodyNumber, bodyNumber]
  );
}

module.exports = {
  refreshAllTricycleFlags,
  refreshTricycleFlag,
};
