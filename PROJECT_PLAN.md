# Project: lineup-nextjs
## Goal
Replace the legacy PHP student attendance check-in app with a Next.js 16 + Prisma 7 application while preserving the current attendance data model.
## Success criteria
- [x] Next.js 16.2.9 App Router project uses TypeScript, Tailwind v4, Prisma 7.8 WASM client, MariaDB driver adapter, and bcryptjs.
- [x] Prisma schema represents the full legacy MySQL data model needed for migration, including new `line_user_id` fields.
- [x] Legacy dropped systems are not reintroduced: no `devices` table and no `teacher_credentials` WebAuthn table. (Verified 2026-07-08 against prod dump: both tables absent.)
- [x] Read-only views can safely inspect migrated data without mutating attendance state.
- [x] LINE Login identity binding replaces legacy device approval and WebAuthn identity flows.
- [x] Check-in, teacher admin, and rollout phases are implemented with verification and rollback plans.
## Milestones
- [x] M1: Foundation — scaffold Next.js/Prisma project and model the database schema.
- [x] M2: Low-risk read paths — build read-only classroom, student, session, and attendance views.
- [x] M3: Identity binding — add LINE Login identity binding for students and teachers. Verified end-to-end in a real browser (login path + bind path).
- [x] M4: Check-in core — implement attendance session lookup and student check-in flow. Verified end-to-end against real data; found + fixed a timezone root-cause bug affecting M2 and M4 alike.
- [x] M5: Teacher admin — implement attendance review, edits, holidays, locations, and exemptions. Fully live-verified against real `lineup_dev` data. Extended well past original scope this session per Trainer feedback from real PHP usage: locations GPS-locate + popup modal, exemptions split to its own page + defaults, LINE-link status page (replaces old device-approval slot), dashboard quick-leave button + default filter, full report/CSV feature (ported from `report.php`/`report_day.php`). See WORKLOG.md 2026-07-02 checkpoint entry for the full inventory.
- [x] M6: Rollout — **DONE & live** (verified 2026-07-08 against the real prod dump `thatnara_lineup_prod`). Next.js app deployed on Plesk and in real daily use. Prod DB fully migrated to the latest schema: `students`/`teachers` LINE cols + unique keys, `teachers.role varchar(50)`, `scan_fail_reports`(+`acknowledged_at`), `school_activities`/`student_activities`, `student_exemptions`, per-room times (`classrooms.check_start/check_end/scanfail_alert_radius_m`). Legacy `devices` + `teacher_credentials` dropped; `central_locations` correctly absent (feature removed). Git `main` fully pushed to `origin/main` (working tree clean). The old "loose ends" list was stale append-only WORKLOG history, not real open work — all closed. Only deferred (not a blocker): LIFF P3 OA rich menu — Trainer opts to pin the LIFF URL in each classroom LINE group instead.
## Key files
- `package.json` — pinned Next.js/Prisma/Tailwind/bcryptjs stack and scripts.
- `prisma.config.ts` — Prisma 7 config with `DATABASE_URL` from environment.
- `prisma/schema.prisma` — legacy-compatible attendance data model.
- `.env.example` — database URL placeholder for legacy DB or migrated copy.
- `src/app/` — App Router UI entrypoint.
- `WORKLOG.md` — chronological project activity log.
## Dependencies / blockers
- A real `DATABASE_URL` is intentionally not configured in Phase 1.
- No database migration or `prisma db push` should run until the target database/copy is explicitly chosen.
- LINE Login channel details are needed before identity binding work.
## Decisions
- 2026-07-02: Use the sibling `homework-next` stack pattern: Prisma 7 WASM client output to `src/generated/prisma`, MariaDB adapter dependency, and no `binaryTargets`.
- 2026-07-02: Keep `attendance_records.status` as `varchar(15)` with documented allowed values instead of a Prisma enum so the physical DB column matches the legacy schema.
- 2026-07-02: Do not model `devices` or `teacher_credentials`; LINE Login will replace those systems in later phases.
- 2026-07-08: M6 confirmed complete — reconciled the stale WORKLOG "loose ends" against real prod dump `thatnara_lineup_prod` + git state; every item was already done. Old TODOs were append-only history, not open work.
- 2026-07-08: LIFF P3 (OA rich menu) deferred indefinitely — access is via the LIFF URL pinned in each classroom's LINE group instead. Not a blocker.
## Notes
- The legacy PHP project at `/Users/kanokkarn/Data/AI Title/projects/lineup` is read-only reference material for this migration.
