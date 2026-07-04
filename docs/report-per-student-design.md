# รายงานรายคน (Per-Student Attendance Report)

Design locked 2026-07-04 with Trainer. Adds a **per-student** view to the existing
**per-day** report at `/classrooms/[id]/report`. Shows students who attend consistently
(สม่ำเสมอ) and those who are frequently absent (ขาดบ่อย).

Related: [[PROJECT_PLAN]] · [[WORKLOG]]

## Why this is a new feature
The existing report (`src/lib/report.ts:loadReportSummary`) aggregates **by day** (one row
per `AttendanceSession`). Trainer wants the orthogonal **by-student** angle, which does not
exist yet.

⚠️ **Critical data fact:** an "absent" student has **NO `AttendanceRecord` row**. The system
computes `absent = totalStudents − checkins − excused` per day. So per-student stats must
iterate every session in the range and, for each active student, derive their status from
(a) whether an `AttendanceRecord` exists and (b) whether an active exemption covers that day.

## Locked decisions
1. **Late counts as full "มา"** → `%มา = (present + late) ÷ วันที่ต้องมา`. Still show a
   separate `สาย` column so late is visible.
2. **ขาดบ่อย = %มา < 80%** (percentage only, not a raw count).
3. **สม่ำเสมอ = %มา ≥ 95%** (or absent == 0). Everything else = ปกติ.
4. **Scope: advisor of the classroom only.** Reuse existing report auth. Owner cross-room is
   deferred to a later iteration (same pattern as `requireClassroomManager`).

## Per-student formula (iterate every session in [startDate, endDate])
```
วันเรียนทั้งหมด (sessionsInRange) = count of AttendanceSession in range
ลา (excused)   = # sessions where an active exemption covers the student that day
วันที่ต้องมา (expected) = sessionsInRange − excused, but only sessions on/after student.createdAt
มา (attended)  = present + late   (student has an AttendanceRecord of that status)
ขาด (absent)   = expected − attended        // no record AND not excused
%มา (attendRate) = attended ÷ expected      // if expected == 0 → render "—", NOT 0%
```
- present / late come from `AttendanceRecord.status`. `pending`/`flagged` count as attended
  (they DID check in) — treat like present for the มา bucket, but may show separately later.
- Exemption resolution must reuse `getExemptMap(classroomId, sessionDate)` (per-day, honors
  permanent weekday exemptions + date-range exemptions), same as `loadReportSummary`.

## Classification
| Badge | Rule |
|-------|------|
| 🟢 สม่ำเสมอ | attendRate ≥ 95% OR absent == 0 |
| 🔴 ขาดบ่อย | attendRate < 80% |
| ⚪ ปกติ | otherwise |

## UI (mobile-first, team design style)
- Tab switch inside `/classrooms/[id]/report`: **[รายวัน]** (existing) / **[รายคน]** (new).
  Reuse the existing start_date/end_date filter and auth guard.
- Top: stat tiles — 🟢 สม่ำเสมอ N · 🔴 ขาดบ่อย N · ⚪ ปกติ N.
- **Section 🔴 ขาดบ่อย first** (sorted attendRate asc) — this is what the teacher must act on.
- **Section 🟢 สม่ำเสมอ**.
- **▸ ดูทั้งหมด** — full sortable table.
- Card rules (per [[feedback-design-style]]): full name on one line, never truncated;
  status badge + action button top-right; tap card → modern popup listing that student's
  day-by-day breakdown (มา/สาย/ลา/ขาด per date).
- Export button — extend the existing `api/classrooms/[id]/report/export`.

## Edge cases (must handle)
- Student enrolled mid-range → only count sessions on/after `student.createdAt` (no
  retroactive absences).
- Permanent exemption (e.g. every Monday) → that day = ลา, not ขาด.
- No sessions in range → "ยังไม่มีข้อมูล".
- expected == 0 for a student → show "—" not 0%.
- Only `status == 1` (active) students.

## Performance
Typical room ~40 students × ~20 sessions = ~800 cells. Fetch sessions with their records +
the per-day exempt maps once, compute in memory. No heavy per-student queries.

## Suggested implementation shape (for the coder)
- `src/lib/report.ts`: add `loadStudentReport(classroomId, startDate, endDate): Promise<StudentReportRow[]>`
  where `StudentReportRow = { studentId, fullName, nickname, numberInClass, sessionsExpected,
  present, late, excused, absent, attendRate (number|null), band: 'regular'|'normal'|'frequent-absent' }`.
- `src/app/classrooms/[id]/report/page.tsx`: add `view=daily|student` searchParam; when
  `student`, call `loadStudentReport` and render a new client.
- New `src/app/classrooms/[id]/report/StudentReportClient.tsx` (tab UI + sections + popup).
- Keep the daily view byte-for-byte unchanged.
