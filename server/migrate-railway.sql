-- =====================================================
-- TARIPA Railway Migration Script
-- Run this once in Railway's MySQL query console
-- to fix the "Unknown column 'created_at'" error
-- =====================================================

-- Add missing created_at column to fare_calculations (if not exists)
ALTER TABLE fare_calculations
  ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- If your Railway table used 'created_at' instead of 'calculated_at', run this too:
ALTER TABLE fare_calculations
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- =====================================================
-- NOTE: Stored procedures (RefreshTricycleFlags,
-- RefreshTerminalAlerts) have been removed from the
-- codebase and replaced with inline SQL in:
--   index.js (cron job)
--   admin.controller.js (updateReportStatus)
-- No need to create them on Railway.
-- =====================================================
