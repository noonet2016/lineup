-- lineup-nextjs: move scan-fail alert radius to per-room. Add classrooms.scanfail_alert_radius_m.
-- Idempotent. null = fall back to the room's check-in location radius. No data touched.
-- Rollback: ALTER TABLE `classrooms` DROP COLUMN `scanfail_alert_radius_m`;
ALTER TABLE `classrooms`
  ADD COLUMN IF NOT EXISTS `scanfail_alert_radius_m` INT NULL;
