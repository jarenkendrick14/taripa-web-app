-- =====================================================
-- TARIPA DATABASE SCHEMA
-- Tricycle Fare Monitoring & Accountability System
-- Angeles City, Pampanga
-- =====================================================

CREATE DATABASE IF NOT EXISTS taripa_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE taripa_db;

-- ─── Users ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100),
  role          ENUM('commuter', 'admin') DEFAULT 'commuter',
  account_age   INT DEFAULT 0 COMMENT 'Days since registration - used for report weighting',
  trusted_contact_name  VARCHAR(100),
  trusted_contact_phone VARCHAR(20),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── Fare Ordinance Matrix ────────────────────────────────
CREATE TABLE IF NOT EXISTS fare_ordinances (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ordinance_no    VARCHAR(50) NOT NULL,
  lgu             VARCHAR(100) NOT NULL DEFAULT 'Angeles City',
  effective_date  DATE NOT NULL,
  base_fare       DECIMAL(8,2) NOT NULL COMMENT 'Base fare in PHP',
  per_km_rate     DECIMAL(8,2) NOT NULL COMMENT 'Additional rate per km in PHP',
  min_fare        DECIMAL(8,2) NOT NULL COMMENT 'Minimum chargeable fare',
  passenger_type  ENUM('regular', 'student', 'senior', 'pwd') DEFAULT 'regular',
  notes           TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed: Angeles City Ordinance No. 723, S-2024
INSERT INTO fare_ordinances (ordinance_no, lgu, effective_date, base_fare, per_km_rate, min_fare, passenger_type, notes, is_active)
VALUES
  ('No. 723, S-2024', 'Angeles City', '2024-01-01', 35.00, 15.00, 35.00, 'regular',  'Standard tricycle fare — Ordinance No. 723, S-2024', TRUE),
  ('No. 723, S-2024', 'Angeles City', '2024-01-01', 28.00, 12.00, 28.00, 'student',  '20% discount for students with valid ID', TRUE),
  ('No. 723, S-2024', 'Angeles City', '2024-01-01', 28.00, 12.00, 28.00, 'senior',   '20% discount for senior citizens', TRUE),
  ('No. 723, S-2024', 'Angeles City', '2024-01-01', 28.00, 12.00, 28.00, 'pwd',      '20% discount for PWD cardholders', TRUE);

-- ─── Tricycle Body Numbers (Pasaway DB) ───────────────────
CREATE TABLE IF NOT EXISTS tricycles (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  body_number VARCHAR(30) NOT NULL UNIQUE,
  toda_name   VARCHAR(100),
  plate_no    VARCHAR(20),
  flagged     BOOLEAN DEFAULT FALSE COMMENT 'Auto-flagged after 5+ reports in 30 days',
  report_count_30d INT DEFAULT 0 COMMENT 'Cache updated by cron job',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_body_number (body_number),
  INDEX idx_flagged (flagged)
);

-- ─── Driver Reports (Pasaway Reports) ────────────────────
CREATE TABLE IF NOT EXISTS driver_reports (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id            INT UNSIGNED NOT NULL,
  body_number        VARCHAR(30) NOT NULL,
  tricycle_id        INT UNSIGNED,
  reported_fare      DECIMAL(8,2) NOT NULL COMMENT 'What the driver charged',
  calculated_fare    DECIMAL(8,2) NOT NULL COMMENT 'Legal fare computed by system',
  overcharge_amount  DECIMAL(8,2) GENERATED ALWAYS AS (reported_fare - calculated_fare) STORED,
  origin_lat         DECIMAL(10,7),
  origin_lng         DECIMAL(10,7),
  destination_lat    DECIMAL(10,7),
  destination_lng    DECIMAL(10,7),
  origin_name        VARCHAR(255),
  destination_name   VARCHAR(255),
  distance_km        DECIMAL(6,3),
  passenger_count    TINYINT DEFAULT 1,
  description        TEXT,
  gps_validated      BOOLEAN DEFAULT FALSE COMMENT 'Was user near the tricycle when reporting?',
  status             ENUM('pending', 'reviewed', 'actioned', 'dismissed') DEFAULT 'pending',
  included_in_ptro_report BOOLEAN DEFAULT FALSE,
  reported_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_body_number (body_number),
  INDEX idx_user_id (user_id),
  INDEX idx_reported_at (reported_at),
  INDEX idx_ptro_pending (included_in_ptro_report, status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tricycle_id) REFERENCES tricycles(id) ON DELETE SET NULL
);

-- ─── Terminals / Hotspot Locations ───────────────────────
CREATE TABLE IF NOT EXISTS terminals (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  lat          DECIMAL(10,7) NOT NULL,
  lng          DECIMAL(10,7) NOT NULL,
  barangay     VARCHAR(100),
  radius_m     INT DEFAULT 100 COMMENT 'Alert radius in meters',
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed: Known Angeles City tricycle terminals
INSERT INTO terminals (name, lat, lng, barangay, radius_m) VALUES
  ('Sindalan Terminal',        15.1638620, 120.5858870, 'Sindalan',         150),
  ('Nepo Mall Terminal',       15.1456780, 120.5925600, 'Sto. Rosario',     100),
  ('SM Clark Terminal',        15.1784560, 120.5956780, 'Malabanias',       120),
  ('Marquee Mall Terminal',    15.1621230, 120.5889450, 'Sto. Rosario',     100),
  ('Holy Angel University',    15.1509870, 120.5918340, 'Sto. Rosario',      80),
  ('Angeles City Hall',        15.1465430, 120.5912100, 'Sto. Rosario',      80),
  ('Pulung Cacutud Terminal',  15.1356780, 120.5812340, 'Pulung Cacutud',   100),
  ('Balibago Terminal',        15.1678900, 120.5967890, 'Balibago',         120);

-- ─── Terminal Report Aggregates (for Bantay Batas) ───────
CREATE TABLE IF NOT EXISTS terminal_alerts (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  terminal_id    INT UNSIGNED NOT NULL,
  report_count   INT DEFAULT 0 COMMENT 'Reports in last 7 days',
  last_updated   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (terminal_id) REFERENCES terminals(id) ON DELETE CASCADE
);

-- ─── Safe Ride Share Logs ────────────────────────────────
CREATE TABLE IF NOT EXISTS safe_ride_logs (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id              INT UNSIGNED NOT NULL,
  body_number          VARCHAR(30),
  origin_lat           DECIMAL(10,7),
  origin_lng           DECIMAL(10,7),
  destination_lat      DECIMAL(10,7),
  destination_lng      DECIMAL(10,7),
  origin_name          VARCHAR(255),
  destination_name     VARCHAR(255),
  trusted_contact_name  VARCHAR(100),
  trusted_contact_phone VARCHAR(20),
  shared_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── PTRO Weekly Reports ─────────────────────────────────
CREATE TABLE IF NOT EXISTS ptro_reports (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  week_start    DATE NOT NULL,
  week_end      DATE NOT NULL,
  report_count  INT DEFAULT 0,
  pdf_path      VARCHAR(255),
  sent_at       TIMESTAMP,
  sent_to       VARCHAR(191),
  status        ENUM('generated', 'sent', 'failed') DEFAULT 'generated',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Fare Calculation Logs ───────────────────────────────
CREATE TABLE IF NOT EXISTS fare_calculations (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED,
  ordinance_id    INT UNSIGNED NOT NULL,
  passenger_type  ENUM('regular','student','senior','pwd') DEFAULT 'regular',
  origin_lat      DECIMAL(10,7),
  origin_lng      DECIMAL(10,7),
  dest_lat        DECIMAL(10,7),
  dest_lng        DECIMAL(10,7),
  origin_name     VARCHAR(255),
  dest_name       VARCHAR(255),
  distance_km     DECIMAL(6,3),
  computed_fare   DECIMAL(8,2),
  resibo_generated BOOLEAN DEFAULT FALSE,
  calculated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ordinance_id) REFERENCES fare_ordinances(id)
);

-- ─── Stored Procedures ───────────────────────────────────

DELIMITER $$

-- Auto-flag tricycles with 5+ reports in last 30 days
CREATE PROCEDURE RefreshTricycleFlags()
BEGIN
  UPDATE tricycles t
  JOIN (
    SELECT body_number, COUNT(*) AS cnt
    FROM driver_reports
    WHERE reported_at >= NOW() - INTERVAL 30 DAY
    GROUP BY body_number
  ) r ON t.body_number = r.body_number
  SET t.report_count_30d = r.cnt,
      t.flagged = (r.cnt >= 5);
END$$

-- Aggregate terminal alerts for last 7 days
CREATE PROCEDURE RefreshTerminalAlerts()
BEGIN
  DELETE FROM terminal_alerts;
  INSERT INTO terminal_alerts (terminal_id, report_count)
  SELECT t.id,
         COUNT(dr.id) AS report_count
  FROM terminals t
  LEFT JOIN driver_reports dr
    ON ST_Distance_Sphere(
         POINT(dr.origin_lng, dr.origin_lat),
         POINT(t.lng, t.lat)
       ) <= t.radius_m
    AND dr.reported_at >= NOW() - INTERVAL 7 DAY
  GROUP BY t.id;
END$$

DELIMITER ;
