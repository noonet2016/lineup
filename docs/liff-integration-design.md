# LIFF Integration Design — student main entry (login + check-in + leave inside LINE)

Status: PLANNING (2026-07-05). Scope confirmed by Trainer: LIFF is the **main student entry** —
students open the app from a LINE rich menu / LIFF URL and do login + check-in + leave request
entirely inside the LINE in-app browser. Teachers keep the normal web (OAuth) app.

## Current state
- Auth today = **LINE Login OAuth** on channel **2010580999** (`LINE_CHANNEL_ID`), scope `profile openid`.
  `exchangeCodeForProfile` stores `profile.userId` → `students.line_user_id` / `teachers.line_user_id`.
- POC (`projects/lineup-liff-poc/index.html`) proved `liff.init` + `getProfile().userId` + `navigator.geolocation`
  all work, using LIFF ID **2010577706-e6xUBcNW** under channel **2010577706**.
- Check-in already uses `navigator.geolocation` (watchPosition retry, commit ee29cb7). LIFF uses the SAME
  geolocation API — no separate LIFF location API. Benefit of LIFF = app-level permission + consistent webview.

## ⚠️ BLOCKING DECISION — channel / provider identity match
LINE `userId` is **per-Provider**: the same LINE user has the SAME userId across all channels under ONE Provider,
but a DIFFERENT userId under a different Provider.

- Existing `line_user_id` values were captured via OAuth on channel **2010580999**.
- The POC LIFF is under channel **2010577706** (different channel).
- If 2010577706 and 2010580999 are under the **same Provider** → LIFF userId == stored line_user_id → existing
  bindings work, students are recognized automatically. ✅
- If **different Providers** → userIds differ → NO student is recognized in LIFF; everyone must re-bind. ❌

### Recommended fix (avoids the risk entirely)
Create a **new LIFF app UNDER the existing LINE Login channel 2010580999** (LINE Developers → channel 2010580999
→ LIFF tab → Add). Then:
- LIFF userId == stored line_user_id (same channel → guaranteed match).
- Backend can verify the LIFF **ID token** against the SAME `LINE_CHANNEL_ID`/`LINE_CHANNEL_SECRET` already in env.
- Discard the POC LIFF 2010577706 (was just a throwaway test).

Alternative: keep 2010577706 ONLY if it is confirmed under the same Provider as 2010580999 — but then token
verification needs that channel's own id, adding a second channel config. Not worth it. Prefer the fix above.

## Auth flow (LIFF)
1. Student opens `https://liff.line.me/{LIFF_ID}` (from rich menu). LIFF loads our endpoint URL (the prod app).
2. Client: `liff.init({liffId})`; if `!liff.isLoggedIn()` → `liff.login()` (stays inside LINE).
3. Client: `liff.getIDToken()` (JWT) → POST to `/api/auth/liff`.
4. Server `/api/auth/liff`: verify the ID token via `https://api.line.me/oauth2/v2.1/verify`
   (POST id_token + client_id=LINE_CHANNEL_ID). Trust the `sub` (= userId) from the VERIFIED token only —
   never trust a client-sent userId.
5. Find `student` by `line_user_id = sub`. If found → mint our existing session cookie (reuse session lib) → done.
   If not found → show "ยังไม่ได้ผูกบัญชี / ไม่พบนักเรียน" with guidance (teacher binds, or first-time bind flow).
6. Redirect into the normal student pages (`/checkin`, `/account`, leave request) — they now run in-session in LIFF.

## Phases
- **P0 (Trainer + config):** decide/confirm LIFF channel per the blocking decision; create LIFF app under 2010580999;
  set LIFF endpoint URL = `https://lineup.thatnarai.net/liff` (or `/`); add `NEXT_PUBLIC_LIFF_ID` (+ keep secrets in Plesk env).
- **P1 (code):** `/liff` entry page (client, loads LIFF SDK, init+login+idToken) → `/api/auth/liff` (verify + session).
  LIFF SDK: load from `https://static.line-scdn.net/liff/edge/2/sdk.js` (CSP/script allowance) or npm `@line/liff`.
- **P2:** ensure `/checkin` + leave-request + `/account` work cleanly inside the LIFF webview (session-based, no OAuth redirect).
  Student self-service leave request (the originally-deferred feature) built here.
- **P3:** LINE OA rich menu → LIFF URL; cutover comms.

## Open questions for Trainer
1. Channel decision above (create LIFF under 2010580999 = recommended).
2. Is there a LINE Official Account (for the rich menu entry)? Needed for P3.
3. Should students who open LIFF but aren't bound yet be able to **self-bind** in LIFF (userId auto-known),
   or must a teacher bind them first? (LIFF makes self-bind trivial and safe — likely yes.)

## Verify / rollback
- Verify: token-verify unit path + a real device open via LINE (studentt recognized → session → checkin).
- Rollback: LIFF is additive; the OAuth web login stays intact. Disable by removing the rich menu link / `/liff` route.
