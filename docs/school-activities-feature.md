# School Activities (นักเรียนกิจกรรม) — feature spec

Design locked 2026-07-04 with Trainer. Generalizes the hardcoded นางรำ/โปงลาง/ร.ด. badges into
an **owner-managed activity list** with explicit student assignment. Independent from exemptions.

Related: [[report-per-student-design]] · [[PROJECT_PLAN]] · [[WORKLOG]]

## Decisions (locked)
1. **Separate activity list + explicit assignment.** Owner defines activities (โปงลาง, นางรำ, ร.ด.,
   วงโยธวาทิต, …) then tags students. NOT derived from exemption. Being in an activity does NOT by
   itself exempt a student from assembly (exemption stays a separate concern).
2. **Badges appear in 3 places:** per-student report (already has a badge slot), daily check-in
   dashboard, and the manage-students page.
3. Single-school (consistent with the rest of the app). Owner-managed (reuse `requireOwner()`).

## Data model (additive — `npm run db:push`, no destructive change)
```prisma
model SchoolActivity {
  id        Int      @id @default(autoincrement())
  name      String   @unique @db.VarChar(100)     // "วงโยธวาทิต"
  color     String   @default("slate") @db.VarChar(20)  // palette token: fuchsia|amber|lime|sky|violet|rose|slate
  isActive  Int      @default(1) @map("is_active") @db.TinyInt
  createdAt DateTime @default(now()) @map("created_at") @db.DateTime(0)
  members   StudentActivity[]
  @@map("school_activities")
}

model StudentActivity {
  id         Int            @id @default(autoincrement())
  studentId  String         @map("student_id") @db.VarChar(20)
  student    Student        @relation(fields: [studentId], references: [studentId], onDelete: Cascade)
  activityId Int            @map("activity_id")
  activity   SchoolActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  @@unique([studentId, activityId])
  @@index([activityId])
  @@map("student_activities")
}
```
- Add to `Student`: `activities StudentActivity[]`.
- Seed the 3 existing categories (นางรำ=fuchsia, โปงลาง=amber, ร.ด.=lime) so nothing regresses.

## Server actions (`src/lib/actions/activities.ts`, owner-only via requireOwner)
- `createActivity(name, color)` / `updateActivity(id, name, color, isActive)` / `deleteActivity(id)`
  (deleteActivity cascades membership; confirm in UI).
- `setStudentActivities(studentId, activityIds[])` — replace a student's memberships in one tx.
- `assignActivityMembers(activityId, studentIds[])` — bulk add/remove for one activity.
- Read helper `getActivityTagMap(classroomId): Map<studentId, {name,color}[]>` for badge rendering.

## UI
1. **/admin (owner)** — new "กิจกรรมของโรงเรียน" section: CRUD activities (name + color picker),
   and per-activity "จัดการสมาชิก" modal (search + check students across classrooms).
2. **Manage students page** — per-student row shows activity badges + an "แก้กิจกรรม" control
   (multi-select) so a homeroom teacher can tag their own students.
3. **Per-student report** — replace exemption-derived `roleTags` with activity-derived tags
   (same badge slot in `StudentReportClient`).
4. **Daily check-in dashboard** — show activity badges next to each student.

## Badge rendering
Shared `ActivityBadge` component keyed by `color` token → Tailwind classes (fuchsia/amber/lime/
sky/violet/rose/slate). Reuse across report, dashboard, manage-students.

## Migration / rollback safety
- ⚠️ **`db:push` FAILS on these tables (errno 150).** Legacy tables are `utf8mb4_general_ci`, but
  Prisma creates new tables `utf8mb4_unicode_ci`, so the `student_id` FK collation mismatches.
  Prisma 7 can't pin per-column collation. **Create the tables with explicit SQL instead** (below),
  then `npx prisma generate` (do NOT `db push` — it would try to alter collation and fail).
- DEV done 2026-07-04: dev DB backed up (`scratch/lineup_dev_backup_20260704_212826.sql`), tables
  created via SQL with `COLLATE=utf8mb4_general_ci`, seeded 3 defaults, client regenerated.
- **PROD (run at deploy):**
  ```sql
  CREATE TABLE `school_activities` (
    `id` INT NOT NULL AUTO_INCREMENT, `name` VARCHAR(100) NOT NULL,
    `color` VARCHAR(20) NOT NULL DEFAULT 'slate', `is_active` TINYINT NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`), UNIQUE KEY `school_activities_name_key` (`name`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  CREATE TABLE `student_activities` (
    `id` INT NOT NULL AUTO_INCREMENT, `student_id` VARCHAR(20) NOT NULL, `activity_id` INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `student_activities_student_id_activity_id_key` (`student_id`,`activity_id`),
    KEY `student_activities_activity_id_idx` (`activity_id`),
    CONSTRAINT `student_activities_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `student_activities_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `school_activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  INSERT INTO `school_activities` (`name`,`color`) VALUES ('นางรำ','fuchsia'),('โปงลาง','amber'),('ร.ด.','lime');
  ```
- Rollback: `DROP TABLE student_activities; DROP TABLE school_activities;` (no other table touched).

## Migration note — supersedes the exemption-derived badges
The current `roleTagsFromReason()` in `src/lib/report.ts` (added earlier today) is replaced by
activity membership. Keep it only if we still want auto-suggest from exemption text; otherwise remove.
