-- ============================================================================
-- lineup-nextjs PROD migration: ee29cb7  ->  50d5bc1  (13 commits)
-- Run this on the Plesk prod DB (phpMyAdmin or mysql CLI) BEFORE/together with
-- "pull now" + build + restart of the new code.
--
-- Idempotent: every statement guards with IF NOT EXISTS / INSERT IGNORE /
-- information_schema checks, so re-running is safe and produces no errors.
-- All new tables use COLLATE=utf8mb4_general_ci to match legacy tables
-- (Prisma db push would mint utf8mb4_unicode_ci -> FK errno 150). Do NOT db push.
--
-- Risk: adds columns/tables only; touches NO existing rows except one optional
-- UPDATE (owner role, at the very bottom, commented out until you set username).
-- Rollback: DROP the 4 new tables + DROP the added columns (see each section).
-- Prod DB here is TEST data re-importable from the PHP backup, per Trainer.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) student_exemptions : leave-request / review columns  (commit 44d871f etc.)
-- ---------------------------------------------------------------------------
ALTER TABLE `student_exemptions`
  ADD COLUMN IF NOT EXISTS `status`               VARCHAR(10)  NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS `requested_by_student` TINYINT      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `reviewed_by`          INT          NULL,
  ADD COLUMN IF NOT EXISTS `review_note`          VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `reviewed_at`          DATETIME     NULL;

ALTER TABLE `student_exemptions`
  ADD INDEX IF NOT EXISTS `student_exemptions_reviewed_by_idx` (`reviewed_by`),
  ADD INDEX IF NOT EXISTS `student_exemptions_status_idx`      (`status`);

-- FK reviewed_by -> teachers(id) (idempotent guard; ADD CONSTRAINT has no IF NOT EXISTS)
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME = 'student_exemptions'
              AND CONSTRAINT_NAME = 'student_exemptions_reviewed_by_fkey');
SET @sql := IF(@fk = 0,
  'ALTER TABLE `student_exemptions` ADD CONSTRAINT `student_exemptions_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `teachers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 2) classrooms : per-room check-in times (null = inherit central/default)
-- ---------------------------------------------------------------------------
ALTER TABLE `classrooms`
  ADD COLUMN IF NOT EXISTS `check_start` VARCHAR(8) NULL,
  ADD COLUMN IF NOT EXISTS `late_after`  VARCHAR(8) NULL,
  ADD COLUMN IF NOT EXISTS `check_end`   VARCHAR(8) NULL;

-- ---------------------------------------------------------------------------
-- 3) central_locations : owner-managed shared check-in points
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `central_locations` (
  `id`         INT           NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100)  NOT NULL,
  `latitude`   DECIMAL(10,7) NOT NULL,
  `longitude`  DECIMAL(10,7) NOT NULL,
  `radius_m`   INT           NOT NULL DEFAULT 400,
  `is_active`  TINYINT       NOT NULL DEFAULT 1,
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
-- (Seed via /admin UI after deploy, or import from a room. Empty is functional.)

-- ---------------------------------------------------------------------------
-- 4) school_activities + student_activities : นักเรียนกิจกรรม
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `school_activities` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100) NOT NULL,
  `color`      VARCHAR(20)  NOT NULL DEFAULT 'slate',
  `is_active`  TINYINT      NOT NULL DEFAULT 1,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `school_activities_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `student_activities` (
  `id`          INT         NOT NULL AUTO_INCREMENT,
  `student_id`  VARCHAR(20) NOT NULL,
  `activity_id` INT         NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_activities_student_id_activity_id_key` (`student_id`,`activity_id`),
  KEY `student_activities_activity_id_idx` (`activity_id`),
  CONSTRAINT `student_activities_student_id_fkey`  FOREIGN KEY (`student_id`)  REFERENCES `students`(`student_id`)      ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `student_activities_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `school_activities`(`id`)     ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO `school_activities` (`name`,`color`) VALUES
  ('นางรำ','fuchsia'), ('โปงลาง','amber'), ('ร.ด.','lime');

-- ---------------------------------------------------------------------------
-- 5) scan_fail_reports : student "scan failed" reports + teacher acknowledge
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `scan_fail_reports` (
  `id`              INT         NOT NULL AUTO_INCREMENT,
  `student_id`      VARCHAR(20) NOT NULL,
  `session_date`    DATE        NOT NULL,
  `reported_at`     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `latitude`        DOUBLE      NULL,
  `longitude`       DOUBLE      NULL,
  `accuracy`        DOUBLE      NULL,
  `acknowledged_at` DATETIME    NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `scan_fail_reports_student_id_session_date_key` (`student_id`,`session_date`),
  KEY `scan_fail_reports_session_date_idx` (`session_date`),
  CONSTRAINT `scan_fail_reports_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
-- 6) teachers.role : column already in schema at ee29cb7, but the physical
--    column may or may not exist on prod. Add if missing (idempotent).
-- ---------------------------------------------------------------------------
ALTER TABLE `teachers`
  ADD COLUMN IF NOT EXISTS `role` VARCHAR(50) NOT NULL DEFAULT 'advisor';

-- Set the owner account (school-wide settings gate). EDIT the username first!
-- UPDATE `teachers` SET `role` = 'owner' WHERE `username` = '<YOUR_PROD_USERNAME>';

-- ============================================================================
-- Verify after running:
--   SHOW TABLES LIKE 'central_locations';
--   SHOW TABLES LIKE 'school_activities';
--   SHOW TABLES LIKE 'student_activities';
--   SHOW TABLES LIKE 'scan_fail_reports';
--   SHOW COLUMNS FROM classrooms LIKE 'check_%';
--   SHOW COLUMNS FROM student_exemptions LIKE 'status';
--   SELECT username, role FROM teachers;
-- ============================================================================
