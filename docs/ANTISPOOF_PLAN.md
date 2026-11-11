# Anti-GPS-spoof (auto-detect + flag) — Plan A

## Problem
Students on-campus but away from the assembly point (e.g. Building 2 robotics room, ~50m
from the dome) use a free "fake GPS / mock location" app to report the dome coordinates and
check in as present. Web/LIFF (webview) **cannot** read Android's `isMock` flag and IP
geolocation is too coarse (city-level) to distinguish two points 50m apart on the same
campus. Therefore prevention is impossible in a pure web app; the chosen strategy (Trainer,
2026-07-23) is **detect + flag for teacher review**, near-zero teacher labor.

## Strategy: silent detection + flag (do NOT reject)
Record the check-in normally, but when spoof signals fire, set `status = "flagged"` +
`isSuspicious = 1` and log the reason. The student still sees a success screen (do not tip
them off to iterate); the teacher sees ⚠️ / flagged in the existing dashboard + report review
lists. No punishment is automated — flagging just surfaces it for the teacher to handle by
policy (talk to student / parent).

## Zero migration
Reuse existing columns: `attendance_records.isSuspicious`, `.status ("flagged")`,
`.ipAddress`, and `attendance_logs.detail` (free text) for the human-readable reason.
No `prisma db push` / no schema change / no prod DB touch.

## Signals (server is the authority; thresholds are tunable constants)
The client currently keeps only the single best fix. Change it to **accumulate every
`watchPosition` sample** (lat, lng, accuracy, altitude, altitudeAccuracy, speed, heading,
timestamp) and send the raw sample array to `submitCheckin` alongside the final lat/lng/accuracy.

Server computes a suspicion score from:
1. **Zero / near-zero positional jitter** — real handheld GPS jitters ~2–5 m between fixes over
   10 s. Mock apps feed byte-identical coordinates every callback. If `samples >= 3` and the
   max pairwise distance among samples `< JITTER_MIN_M` (default 0.5 m) → strong signal.
2. **Altitude absent on all fixes** — real GNSS fix usually has `altitude`; many mocks leave it
   null → supporting signal.
3. **Constant unrealistic accuracy** — accuracy identical across all samples AND `<= 5 m`
   (mock default) → supporting signal.
4. **Exact-centroid match** — submitted point within `CENTROID_EPS_M` (default 1 m) of the
   configured location center (student copied the target coords) → strong signal.

Flag rule (tunable): flag if **any strong signal**, OR **>= 2 supporting signals**.
Keep every threshold as a named constant at the top of the scoring function with a comment.

### Deliberately NOT used
- **IP-reuse / same-device-many-students**: on school WiFi everyone shares one NAT public IP,
  so IP reuse is meaningless here. Still **store `ipAddress`** (from `x-forwarded-for`, Plesk/
  Passenger sits behind a proxy) for forensics only — never auto-flag from it.

## Files to touch
- `src/app/checkin/CheckinClient.tsx` — accumulate all `watchPosition` samples in
  `requestLocation()` (and keep `best` for the existing flow); pass the sample array to
  `submitCheckin`. `coordsRef` gains a `samples` field.
- `src/lib/checkin.ts` — `submitCheckin` signature takes optional `samples`; add
  `scoreSuspicion(samples, finalLat, finalLng, location)` returning `{ suspicious, reasons[] }`;
  when suspicious, force `status="flagged"`, `isSuspicious=1`, and `logEvent(..., "spoof_suspected", reason)`.
  Read client IP from `headers()` (`x-forwarded-for` first hop) and store in `ipAddress`.
- `src/lib/geo.ts` — optional helper `maxPairwiseDistance(samples)` reusing `haversineDistance`.
- Labels: `flagged` currently reads "นอกรัศมี" in several places. Broaden the student-facing +
  teacher-facing label to "รอตรวจสอบ" so it covers both out-of-radius and spoof-suspected, OR
  keep "นอกรัศมี" for the out-of-radius reason and rely on the logged reason text to
  distinguish. (Teacher review already shows ⚠️.) Keep it minimal — do not rename the DB value.

## Honest limitation (already accepted by Trainer)
Catches casual free-app spoofers (≈99%). A student who deliberately injects jitter into the
payload can still defeat it — no web-only system can stop that. Goal is cost + detectability,
not a perfect wall.

## Verification
- Build passes (`npm run build`).
- Simulate: submit `samples` all identical + altitude null → record lands `flagged`+`isSuspicious`,
  log has `spoof_suspected`. Submit realistic jittered samples → stays `present/late`.
- No false-flag on a normal in-radius check-in with 3+ jittered fixes.
