# Deployment Plan: lineup-nextjs

This document outlines the concrete rollout, data migration, verification, and rollback plan for deploying the new Next.js 16 + Prisma 7 + MariaDB attendance system (`lineup-nextjs`), replacing the legacy PHP application.

> [!NOTE]
> This plan draws on proven patterns and solutions resolved during the successful deployment of the sibling project [homework-next](file:///Users/kanokkarn/Data/AI%20Title/projects/homework-next) on the same Hostatom/Plesk hosting environment.

---

## 1. Target Subdomain (Trainer-confirmed 2026-07-02)

* **Current Legacy Status**: The old PHP attendance application is live and actively used by teachers and students at `lineup.thatnarai.net/lineup/` — note the app is namespaced under the `/lineup/` *path*, not served from the subdomain root.
* **Target**: Reuse the SAME existing subdomain `lineup.thatnarai.net`, deploying the new Next.js app at the **subdomain root** (`https://lineup.thatnarai.net/`). No new subdomain/DNS record is needed. The legacy PHP app keeps running unchanged at its `/lineup/` path on the same host — the two do not collide because Plesk serves them from different document roots (subdomain root vs. the `/lineup/` subfolder within the legacy docroot), confirmed by Trainer.
* **Governance / Safety Policy Compliance**:
  > [!IMPORTANT]
  > Per safety policy, the legacy PHP application and its database must remain fully active and untouched during the rollout. Because it lives under `/lineup/` and the new app is deployed at the subdomain root, both can run side-by-side on the same subdomain for verification before any cutover — the legacy app's URL (`lineup.thatnarai.net/lineup/`) stays a live fallback throughout.

---

## 2. Pre-Deployment Gotchas & Checklist

Below is the checklist adapted from `homework-next` to avoid build-time errors, Passenger crashes, and CWD issues on Plesk:

| Gotcha / Issue | Description | Mitigation / Action | Status |
| :--- | :--- | :--- | :--- |
| **Prisma 7 Build Validation** | Next.js build-time check fails if no `DATABASE_URL` is set. | Resolved via fallback in [prisma.config.ts](file:///Users/kanokkarn/Data/AI%20Title/projects/lineup-nextjs/prisma.config.ts) using `process.env.DATABASE_URL \|\| "mysql://..."`. | ✅ Done |
| **Password Special Characters** | `@` in MySQL connection strings breaks URL parsing. | Any `@` in the production MySQL password **must** be URL-encoded to `%40` in the `.env` file. | 📝 Checklist |
| **Next.js Standalone Build** | Plesk Passenger requires a minimal standalone server build. | Confirmed `output: "standalone"` is set in [next.config.ts](file:///Users/kanokkarn/Data/AI%20Title/projects/lineup-nextjs/next.config.ts). Run command on Plesk: `node .next/standalone/server.js`. | ✅ Done |
| **Local Build Execution** | Running `next build` on a shared Plesk host risks Out-Of-Memory (OOM). | Always run `npm run build` **locally**, then upload/git-push the built project directory (including `.next/standalone` and `.next/static`). | 📝 Checklist |
| **CWD Discrepancies** | Plesk Passenger changes the directory, breaking relative Prisma path resolution. | Created a CWD-independent script [scripts/db-push.js](file:///Users/kanokkarn/Data/AI%20Title/projects/lineup-nextjs/scripts/db-push.js) to resolve the `.env` path and run `prisma db push` safely. | ✅ Done |
| **Passenger Redirect Bug** | Next.js standard `redirect()` throws exceptions that crash Passenger. | Ensure client-side redirection (`window.location.replace`) is used for user redirects instead of server-side `redirect()` if Passenger exhibits stability issues. | 📝 Checklist |

---

## 3. Real Data Migration & Schema Mapping

The current local development setup uses the `lineup_dev` database (MariaDB), which was imported from a fresh production dump (`thatnara_lineup.sql`).

### Database Infrastructure
* **Source Database**: The live MySQL database of the legacy PHP app (referred to as `lineup_prod_legacy`).
* **Target Database**: A separate new database on Plesk (e.g., `lineup_v2_prod`).
* **Migration Mode**: Idempotent schema creation via `scripts/db-push.js`, followed by data synchronization.

### Legacy Schema vs. New Schema Alignment
The new Prisma schema drops two legacy tables entirely in favor of LINE Login:
1. `devices` (Previously handled device approvals for student logins).
2. `teacher_credentials` (WebAuthn credentials).

> [!WARNING]
> **Data Loss & Communication Implications**:
> * Dropping these tables is an intentional design decision (M3) because **LINE Login identity binding replaces device approvals and WebAuthn credentials**.
> * **Implication**: Any previously registered device profiles or WebAuthn keys are discarded. Students and teachers will not use them.
> * **Action**: Teachers and students must be informed to register and bind their accounts via LINE on first login. No historical attendance records (`attendance_records`) will be lost.

### Synchronization Plan
1. Export the latest production snapshot from `lineup_prod_legacy`.
2. Import this snapshot into the new production database `lineup_v2_prod`.
3. Execute `node scripts/db-push.js` on the Plesk environment to run the Prisma migrations. This will safely alter the schema structure (adding `line_user_id` fields, dropping `devices` and `teacher_credentials` tables, and cleaning up foreign keys).
4. Run a sanity check count on `students`, `classrooms`, and `attendance_records` to ensure 100% parity.

---

## 4. LINE Login Configuration

For LINE Login to work in production:
1. **Registered Callback URLs**:
   * Currently set to `http://localhost:3000/api/auth/line/callback` for development.
   * **Trainer Step**: Add the production callback URI `https://lineup.thatnarai.net/api/auth/line/callback` to the **Callback URL** field under the **LINE Login** tab in the LINE Developers Console for the "Thatnara" channel.
2. **Production Environment Variables (`.env`)**:
   Ensure the following are updated in the Plesk server environment:
   ```env
   LINE_CHANNEL_ID="2010580999"
   LINE_CHANNEL_SECRET="[Production Secret]"
   LINE_REDIRECT_URI="https://lineup.thatnarai.net/api/auth/line/callback"
   SESSION_SECRET="[Generate a long random secure string]"
   DATABASE_URL="mysql://[user]:[encoded_pass]@[host]:3306/[db_name]"
   ```

---

## 5. Pre-Cutover Verification Plan

Before telling teachers or students to use the new app, perform the following tests on the live subdomain:

1. **Low-Risk Read Paths (M2)**:
   * Navigate to `/classrooms` and `/classrooms/1`. Confirm the classroom dashboard displays student counts, advisors, and historical stats correctly.
   * Check a student's history page (e.g., `/classrooms/1/students/27251`). Confirm dates and attendance records align with legacy history.
2. **LINE Identity Binding (M3)**:
   * Access `/login` and attempt to log in as a teacher (e.g., `advisor1`).
   * Bind the account to LINE on the `/account` page. Verify the "✅ เชื่อมบัญชี LINE แล้ว" badge displays.
   * Log out, then log in using the "เข้าสู่ระบบด้วย LINE" button.
3. **GPS Check-In Core (M4)**:
   * Perform a test check-in with a mock/test student account.
   * Confirm browser Geolocation prompts for permission and computes the correct distance.
   * Verify the check-in time matches the Bangkok timezone (`Asia/Bangkok`) in the database.
4. **Teacher Administration (M5)**:
   * Access `/classrooms/1/settings`.
   * Add and delete a test holiday, create and toggle a test check-in location, and add a test exemption.
   * Go to a student profile, modify their attendance status, write a reason, and verify the status is updated instantly on the dashboard.

---

## 6. Rollback Plan

If critical, unresolved bugs occur in the Next.js app post-cutover:
1. **Subdomain/Path Action**: Since the legacy app is untouched at `lineup.thatnarai.net/lineup/`, tell teachers/students to keep using that URL directly — no DNS change needed, it never stopped working. If needed, the Next.js app at the subdomain root can be taken down (stop the Passenger app / point the root docroot elsewhere) without affecting `/lineup/` at all, since Plesk serves them from separate document roots.
2. **Database Integrity**:
   * The legacy PHP application and its database are untouched.
   * Because the database schema of the legacy app wasn't modified (we created a separate database `lineup_v2_prod` for the Next.js app), we can roll back instantly.
   * Any check-ins logged during the Next.js trial period can be exported as SQL insert statements and backported to the legacy DB if needed.

---

## 7. Open Questions / Needs Trainer Input

> [!WARNING]
> Do not guess or execute commands regarding the following without explicit Trainer approval:

1. ~~**Exact Domain Name**~~ — RESOLVED 2026-07-02: reuse `lineup.thatnarai.net`, deploy the Next.js app at the subdomain root; legacy PHP stays at its existing `/lineup/` path, no collision.
2. **Plesk SSH & Shell Status**: Confirm if SSH access is enabled and whether Git deploy is configured for the repository. Also confirm how Plesk is configured to route the subdomain root vs. the `/lineup/` subfolder to two different apps (Node.js app at root + existing PHP app hook at `/lineup/`) — this may need a Plesk panel check (Domains > lineup.thatnarai.net > Hosting Settings) to confirm the `/lineup/` path won't be shadowed by the new Node.js app's catch-all routing.
3. **Production Database Credentials**: The Trainer must provide/configure the production database name, user, and password on Plesk.
4. **LINE Channel details**: Confirm if we should continue using the current "Thatnara" LINE Login channel (ID `2010580999`) or if a dedicated production channel will be provided.
