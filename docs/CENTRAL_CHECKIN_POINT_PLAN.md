# จุดเข้าแถวส่วนกลาง (Admin) + override รายห้อง — แนวทาง

> สถานะ: **draft / รออนุมัติ** · เกี่ยว: [[ADMIN_MODE_PLAN]] · [[WORKLOG]]

## เป้าหมาย
- Admin กำหนด **จุดเข้าแถวส่วนกลาง 1 จุด (โดม)** = ค่า default ของทั้งโรงเรียน
- ครูประจำห้อง **override** ด้วยจุดของห้องได้ (มีอยู่แล้ว) หรือ **กลับไปใช้จุดส่วนกลาง**

## ข่าวดี: logic มีแล้ว ไม่ต้องแตะ
`getActiveLocation(classroomId)` (checkin.ts:22) ทำ 2 ชั้นอยู่แล้ว:
1. ห้องมี `checkin_locations` ที่ `isActive=1` → ใช้จุดห้อง (override)
2. ไม่มี → fallback `system_settings.dome_lat/dome_lng/radius_m` (ส่วนกลาง)

## สิ่งที่ต้องทำ (ไม่มี schema migration)
### 1) Action ใหม่ (settings.ts, `requireAdmin`)
- `updateCentralCheckinPoint(formData)` — upsert `dome_lat`, `dome_lng`, `radius_m` ลง `system_settings`
- `clearRoomLocationOverride()` (หรือขยาย setActiveLocation) — ครูสั่งปิด active ทุกจุดของห้อง → fallback ส่วนกลางอัตโนมัติ

### 2) Admin console — แท็บใหม่ "📍 จุดเข้าแถว"
- ฟอร์มแก้จุดส่วนกลาง: lat/lng/รัศมี + ปุ่ม **"ดึงตำแหน่งปัจจุบัน"** (reuse `navigator.geolocation` แบบเดียวกับ SettingsClient:85) + กรอกเอง
- โชว์ค่าปัจจุบัน + จำนวนห้องที่ override อยู่ (ไว้เตือน)
- **Map picker (รวมในรอบนี้):** ติดตั้ง **Leaflet + OpenStreetMap** (ฟรี ไม่ต้อง API key) — คลิกบนแผนที่วางหมุด, ลากหมุดได้, วงกลมรัศมี preview, ปุ่มดึง GPS recenter; lat/lng/รัศมี sync กับฟอร์ม. reuse component เดียวกันทั้งจุดส่วนกลาง (admin) และจุดห้อง (ครู)

### 3) หน้าตั้งค่าห้อง — ทำ 2 ชั้นให้ชัด
- badge บอกสถานะ: **"ใช้จุดส่วนกลาง (โดม)"** เมื่อห้องไม่มีจุด active / **"override: <ชื่อจุด>"** เมื่อมี
- ปุ่ม **"กลับไปใช้จุดส่วนกลาง"** → เรียก clearRoomLocationOverride

## สิทธิ์
- จุดส่วนกลาง = `requireAdmin` เท่านั้น
- จุดห้อง (add/edit/setActive/clear) = ครูประจำห้อง (เดิม, `requireTeacherClassroom`) — admin เข้าได้ทุกห้องด้วย (owner-bypass เดิม→admin)

## ความเสี่ยง & กันพลาด
- **กระทบการเช็คอินจริง** — พิกัด/รัศมีผิด = นักเรียนเช็คไม่ได้ ⇒ ต้อง verify: ตั้งค่าส่วนกลาง → ห้องที่ไม่ override ใช้ค่าใหม่ / ห้องที่ override ยังใช้ของตัวเอง / ปุ่มกลับไปส่วนกลางได้ผล
- ไม่มี schema migration → rollback = revert code; ค่าเดิมใน system_settings สำรองไว้ก่อนแก้
- Backup DB dev มีแล้ว (`scratch/db-dumps/lineup_dev_prerestore_*.sql`)

## แบ่งงาน
- Backend actions + admin tab + room-settings badge/button → Tokai Teio
- Rudolf: spec, verify getActiveLocation resolution ด้วย script (จำลอง override/fallback) + build
