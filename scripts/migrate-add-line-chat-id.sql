-- lineup-nextjs: add students.line_chat_id (public LINE ID for teacher chat link)
-- Idempotent. Column inherits table collation (utf8mb4_general_ci). No FK, no data touched.
-- Rollback: ALTER TABLE `students` DROP COLUMN `line_chat_id`;
ALTER TABLE `students`
  ADD COLUMN IF NOT EXISTS `line_chat_id` VARCHAR(50) NULL;
