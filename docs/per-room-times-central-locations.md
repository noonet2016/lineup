# Per-room assembly times + central check-in locations

Design locked 2026-07-04 with Trainer. Two settings-page changes:
1. **Times unlocked per room** — advisor sets their room's assembly times; central is only the default.
2. **Central check-in locations** — owner keeps a central list; advisor imports (copies) into their room.

Related: [[school-activities-feature]] · [[PROJECT_PLAN]] · [[WORKLOG]]

## Current state (before)
- Times: central `SystemSetting` (check_start/late_after/check_end), owner-only via `updateSystemSettings`.
  `openTodaySession` stamps every session from the central values → all rooms identical. Advisors see
  the time fields read-only.
- Locations: `CheckinLocation` is already per-classroom; advisor add/edit/setActive their own room
  (`addLocation`/`editLocation`/`setActiveLocation`, guarded by `requireTeacherClassroom`). No central concept
  (only single fallback keys dome_lat/dome_lng/radius_m in SystemSetting).

## Locked decisions
1. **Times: central = default, room override (null = inherit).** Owner still sets the school-wide default
   in the SystemSetting keys. Each Classroom gets nullable time columns; null → use central default.
   Advisor edits their own room's times (no longer read-only).
2. **Central locations: import = COPY into room.** Owner manages a central location list; advisor clicks
   "ดึงจากส่วนกลาง" to copy a central location into their room as a normal `CheckinLocation` (decoupled —
   later edits to the central record do NOT change already-imported room copies). Advisor keeps full
   add/edit/delete/setActive on their room (already works).

## Data model (additive)
```prisma
model Classroom {
  // ...existing...
  checkStart String? @map("check_start") @db.VarChar(8)   // "HH:MM:SS", null = inherit central
  lateAfter  String? @map("late_after")  @db.VarChar(8)
  checkEnd   String? @map("check_end")   @db.VarChar(8)
}

model CentralLocation {              // owner-managed shared list (NOT tied to a classroom)
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(100)
  latitude  Decimal  @db.Decimal(10, 7)
  longitude Decimal  @db.Decimal(10, 7)
  radiusM   Int      @default(400) @map("radius_m")
  isActive  Int      @default(1) @map("is_active") @db.TinyInt
  createdAt DateTime @default(now()) @map("created_at") @db.DateTime(0)
  @@map("central_locations")
}
```
Migration done by Rudolf via explicit SQL (collation `utf8mb4_general_ci` to match legacy — same gotcha as
the activities tables; `db push` on new tables mints utf8mb4_unicode_ci). Classroom ALTER inherits the
table's general_ci. See WORKLOG for exact SQL.

## Server actions (`src/lib/actions/settings.ts` unless noted)
- **`updateClassroomTimes(formData)`** — NEW, guarded by `requireTeacherClassroom` (advisor of the room).
  Validates HH:MM(:SS), saves check_start/late_after/check_end onto that Classroom row. Also updates today's
  open session for that room if one exists (mirror the existing updateSystemSettings session-sync). An empty
  field clears the override (null → inherit central).
- Keep `updateSystemSettings` (owner) for the school-wide DEFAULT times (+ scanfail radius).
- **`openTodaySession`** — change the time source: use the Classroom's check_start/late_after/check_end when
  set, else fall back to the central SystemSetting values (current behaviour), else the hardcoded defaults.
- Central locations (owner-only, `requireOwner`), likely a new `src/lib/actions/centralLocations.ts`:
  `createCentralLocation`, `updateCentralLocation`, `deleteCentralLocation`.
- **`importCentralLocation(centralLocationId)`** — advisor (`requireTeacherClassroom`): copy the central
  record into the caller's room as a new `CheckinLocation` (name/lat/lng/radius; isActive=0). Idempotency:
  allow duplicates or skip if same name already exists in the room (skip-with-message is nicer).

## UI
1. **Settings page (`/classrooms/[id]/settings`, SettingsClient)**:
   - Times section: make the fields EDITABLE for the room's advisor (drop the read-only-for-non-owner gate on
     times). Show a hint "ว่างไว้ = ใช้เวลาเริ่มต้นของโรงเรียน (HH:MM)". Submit → `updateClassroomTimes`.
   - Locations section: add a **"ดึงจากส่วนกลาง"** control listing central locations with an import button →
     `importCentralLocation`. Existing add/edit/delete/setActive stay.
   - Owner still sees the school-wide default-times section (updateSystemSettings) — label it clearly as the
     DEFAULT, separate from the room's own times.
2. **/admin (owner)**: add a "จุดเข้าแถวส่วนกลาง" manager (CRUD central_locations) — same pattern as the
   activities section.

## Migration / rollback safety
- DEV: back up first. ALTER classrooms ADD 3 nullable time columns; CREATE central_locations
  (COLLATE utf8mb4_general_ci); optionally seed one central location from existing dome_lat/dome_lng/radius_m.
  Then `npx prisma generate` (NOT db push — collation).
- PROD (deploy): same explicit SQL. Additive, no data loss.
- Rollback: `DROP TABLE central_locations; ALTER TABLE classrooms DROP COLUMN check_start, DROP COLUMN late_after, DROP COLUMN check_end;`

## Note
`openTodaySession` currently reads central; existing already-open sessions keep their stamped times. The
per-room times take effect for sessions opened AFTER this change (plus the today-session sync in
updateClassroomTimes).
