# Admin Mode — แนวทางออกแบบ (dedicated admin account)

> สถานะ: **draft / รออนุมัติจาก Trainer ก่อนลงมือ** · เกี่ยวข้อง: [[PROJECT_PLAN]] · [[WORKLOG]]

## เป้าหมาย
แยก **admin** ออกเป็นบัญชี/โหมดต่างหาก ไม่ผูกกับการเป็นครูประจำห้อง —
มี **สิทธิ์เต็ม (superadmin)**: ดูภาพรวมทั้งโรงเรียน + เข้าถึง/แก้ได้ทุกห้องเหมือน owner

## การตัดสินใจที่ล็อกแล้ว (จาก Trainer) — ปรับใหญ่
1. **ยกการจัดการระบบทั้งหมดมาไว้ที่ `admin` คนเดียว** — admin = ผู้จัดการระบบเพียงผู้เดียว
2. **`admin` รับสิทธิ์ owner เดิมทั้งหมด** — settings โรงเรียน, จัดการครู/ห้อง/กิจกรรม, เข้าทุกห้อง, ภาพรวม
3. **ปลด role `owner` ทิ้ง (deprecate)** — owner เดิมลดชั้นเป็นครูธรรมดา (`role="advisor"`) ดูแลเฉพาะห้องตัวเอง ไม่เกี่ยวกับการจัดการระบบอีก
4. **admin ไม่ต้องมี homeroom** — เป็นบัญชีจัดการระบบล้วนๆ

## หลักการสำคัญ
- auth role ระดับ session คงไว้แค่ `student` / `teacher` (มีเช็ค `session.role !== "teacher"` กระจาย ~15+ จุด) — admin ยัง login เป็น **teacher-type**, subrole `"admin"`
- **เลิกใช้ subrole `owner`** — logic ทุกจุดที่เช็ค `role === "owner"` **เปลี่ยนเป็น `role === "admin"`** (rename `requireOwner`→`requireAdmin`, `isOwner`→`isAdmin`)
- classroom-bypass (`teacher.ts:50`) → เช็ค `admin` เท่านั้น (owner ไม่ bypass อีก เพราะเป็นครูธรรมดาแล้ว)
- เหลือ "ศูนย์จัดการระบบเดียว" = admin ชัดเจน ไม่มีสองศูนย์อำนาจ

## Data migration (สำคัญ — มีการแก้ข้อมูล)
- **owner เดิม** (`role="owner"`) → `UPDATE ... SET role='advisor'` (ยังถือห้องประจำเดิมไว้ เป็นครูปกติ)
- **สร้างบัญชี admin ใหม่ 1 ตัว** (`role="admin"`, ไม่มี classroom) เป็นผู้จัดการระบบ
- ทำบน dev ก่อน (มี backup ที่ `scratch/db-dumps/lineup_dev_prerestore_*.sql`); prod ค่อยทำตอน deploy

## ขอบเขตงาน (4 ชั้น)

### 1) Data / Account
- ไม่ต้อง migrate schema (`role` เป็น `VarChar(50)` อยู่แล้ว รับค่า `"admin"` ได้เลย)
- action ใหม่ `createAdmin(username, password, fullName)` — role=`admin`, **ไม่สร้าง classroom** (ตอนนี้ `createTeacherWithClassroom` บังคับ roomName)
- `deleteTeacher` / owner-guard: กันลบบัญชี `admin` ด้วย (ปัจจุบันกันเฉพาะ `owner`)

### 2) Auth / Routing
- `/account` (ตัวกระจายหลัง login): ถ้า `role=admin` → `redirect("/admin")` (ไม่ใช่ `/classrooms/[id]`)
- `admin/page.tsx` guard: ปัจจุบัน `me.role !== "owner"` เด้งออก → เปลี่ยนเป็น `!isAdminRole(me.role)`
- แก้สมมติฐาน `me.advisedClassrooms[0]` ที่จะเป็น `undefined` สำหรับ admin (chrome/back-links ต้องไม่พัง)

### 3) สิทธิ์ (ย้าย owner → admin ทั้งหมด)
- ทุกจุดที่เช็ค `role === "owner"` → เปลี่ยนเป็น `role === "admin"` (owner ไม่เหลือสิทธิ์จัดการระบบเลย)
- `src/lib/teacher.ts` — `requireOwner`→`requireAdmin`, `isOwner`→`isAdmin`, classroom-bypass (`:50`) เช็ค admin เท่านั้น
- `src/lib/actions/settings.ts` — `requireOwner` (:136,:157) → `requireAdmin`
- `src/lib/actions/admin.ts` — guard ทุกจุด → admin; **guard การลบบัญชี**: กันลบบัญชี admin (แทนที่ของเดิมที่กัน owner)
- ตรวจให้ครบทุก reference ของสตริง `"owner"` ในโค้ด (grep) — ห้ามตกหล่น มิฉะนั้นเกิด privilege gap

### 4) Console UI — `/admin` เป็นพื้นที่ของ admin
- แท็บ **📊 ภาพรวม (ใหม่)**: การ์ดสรุปวันนี้ · เทียบรายห้อง · แนวโน้ม 7–30 วัน · top ขาด/สาย · นร.ยังไม่ผูก LINE + scan-fail ค้าง
- แท็บ **จัดการครู/ห้อง** (มีอยู่แล้ว) + ปุ่ม "เพิ่ม admin" (เรียก `createAdmin`)
- แท็บ **กิจกรรม** (มีอยู่แล้ว)
- ลิงก์เข้า `/classrooms/[id]` ของทุกห้องได้ (ทำงานได้ทันทีเมื่อ owner-bypass รับ admin)
- Chrome/nav ของ admin: ไม่โชว์ "ห้องของฉัน" แต่โชว์ "คอนโซล admin" + รายการทุกห้อง

## ความเสี่ยง & การกันพลาด (auth — สำคัญ)
- **หลัก:** ต้องไม่มี privilege gap — ไล่แก้ทุกจุด `role === "owner"` ให้ครอบ admin มิฉะนั้น admin จะโดนปฏิเสธกลางคัน
- **Backup/rollback:** ไม่มี schema migration (rollback = revert โค้ด) ; DB dev มี backup แล้วที่ `scratch/db-dumps/lineup_dev_prerestore_*.sql`
- **Verify:** สร้างบัญชี admin ทดสอบ 1 ตัว (ไม่มีห้อง) → login → ต้องเด้ง `/admin` → เปิดภาพรวมได้ → เข้า `/classrooms/[id]` ห้องใดก็ได้ → owner เดิมยังทำงานปกติ → ครู advisor ทั่วไปยังเข้าได้เฉพาะห้องตัวเอง (ต้องไม่หลุดสิทธิ์)

## แผนแบ่งงาน (delegate)
- Backend/auth (teacher.ts, auth flow, actions) → **Tokai Teio** (แตะหลายไฟล์ + เรื่อง auth)
- Overview aggregation + UI แท็บใหม่ → **Mejiro** หรือ Teio
- Rudolf: เขียน spec, verify build + ทดสอบ flow สิทธิ์เอง (auth = ห้าม dispatch แล้วปล่อย)
