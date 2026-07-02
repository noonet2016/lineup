"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import {
  addHoliday,
  addLocation,
  deleteHoliday,
  deleteLocation,
  editLocation,
  openTodaySession,
  setActiveLocation,
  updateSystemSettings,
} from "@/lib/actions/settings";
import { changeTeacherPassword } from "@/lib/actions/teacherAccount";
type Settings = { dome_lat: string; dome_lng: string; radius_m: string; check_start: string; late_after: string; check_end: string };
type Holiday = { dateStr: string; label: string; name: string };
type Location = { id: number; name: string; lat: number; lng: number; radius: number; isActive: boolean };

function Banner({ text, kind }: { text: string; kind: "success" | "error" }) {
  return (
    <div
      className={`p-3 rounded-xl text-sm border ${kind === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}
    >
      {text}
    </div>
  );
}

export default function SettingsClient({
  classroomId,
  roomName,
  fullName,
  settings,
  sessionOpen,
  holiday,
  holidays,
  locations,
}: {
  classroomId: number;
  roomName: string;
  fullName: string;
  settings: Settings;
  sessionOpen: boolean;
  holiday: string | null;
  holidays: Holiday[];
  locations: Location[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"main" | "locations" | "holidays" | "account">("main");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const passwordFormRef = useRef<HTMLFormElement | null>(null);
  const locLatRef = useRef<HTMLInputElement | null>(null);
  const locLngRef = useRef<HTMLInputElement | null>(null);
  const [gpsStatus, setGpsStatus] = useState<{ icon: string; text: string } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  function openAddLocation() {
    setEditingLocationId(null);
    setGpsStatus(null);
    setShowLocationModal(true);
  }

  function openEditLocation(id: number) {
    setEditingLocationId(id);
    setGpsStatus(null);
    setShowLocationModal(true);
  }

  function closeLocationModal() {
    setShowLocationModal(false);
    setEditingLocationId(null);
    setGpsStatus(null);
  }

  function useGpsForLocationForm() {
    if (!navigator.geolocation) {
      setGpsStatus({ icon: "⚠️", text: "อุปกรณ์ไม่รองรับ GPS" });
      return;
    }
    setGpsBusy(true);
    setGpsStatus({ icon: "⏳", text: "กำลังดึงตำแหน่ง..." });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (locLatRef.current) locLatRef.current.value = pos.coords.latitude.toFixed(7);
        if (locLngRef.current) locLngRef.current.value = pos.coords.longitude.toFixed(7);
        setGpsStatus({ icon: "✅", text: `ได้ตำแหน่งแล้ว (±${Math.round(pos.coords.accuracy)} ม.)` });
        setGpsBusy(false);
      },
      () => {
        setGpsStatus({ icon: "⚠️", text: "ดึงตำแหน่งไม่สำเร็จ — กรอกพิกัดเอง" });
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function submitPasswordChange(formData: FormData) {
    setBanner(null);
    startTransition(async () => {
      const result = await changeTeacherPassword(formData);
      setBanner({ text: result.message, kind: result.ok ? "success" : "error" });
      if (result.ok) passwordFormRef.current?.reset();
    });
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setBanner(null);
    startTransition(async () => {
      const result = await action();
      setBanner({ text: result.message, kind: result.ok ? "success" : "error" });
      router.refresh();
    });
  }

  const editingLocation = locations.find((l) => l.id === editingLocationId) ?? null;

  return (
    <TeacherShell active="settings" fullName={fullName} roomName={roomName} classroomId={classroomId}>
      <main className="max-w-full mx-auto safe-px py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-white">จัดการการตั้งค่า</h1>
        <p className="text-slate-400 text-sm mt-1">ห้องที่ปรึกษา ม.{roomName}</p>
      </div>
      {banner && <div className="max-w-3xl mx-auto"><Banner text={banner.text} kind={banner.kind} /></div>}

      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2 mb-5 overflow-x-auto whitespace-nowrap no-scrollbar">
          <TabButton active={activeTab === "main"} onClick={() => setActiveTab("main")} color="indigo">⚙️ ตั้งค่าหลัก</TabButton>
          <TabButton active={activeTab === "locations"} onClick={() => setActiveTab("locations")} color="cyan">📍 จุดเข้าแถว</TabButton>
          <TabButton active={activeTab === "holidays"} onClick={() => setActiveTab("holidays")} color="indigo">📅 วันหยุด</TabButton>
          <TabButton active={activeTab === "account"} onClick={() => setActiveTab("account")} color="indigo">🔑 บัญชี</TabButton>
        </div>

      <div className="grid">
      {/* Today's session */}
      <section className={`col-start-1 row-start-1 ${activeTab === "main" ? "visible" : "invisible pointer-events-none"} glass-panel rounded-2xl p-8 shadow-2xl relative`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">ตั้งค่าทั่วไป</h2>
        </div>
        <div className={`mb-7 p-4 rounded-2xl border ${holiday ? "bg-indigo-500/5 border-indigo-500/20" : sessionOpen ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
          {holiday ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏖️</span>
              <div>
                <p className="text-sm font-bold text-white">วันนี้เป็นวันหยุด · {holiday}</p>
                <p className="text-xs text-slate-400 mt-0.5">ไม่มีการเปิดรอบเช็คชื่อในวันนี้</p>
              </div>
            </div>
          ) : sessionOpen ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-sm font-bold text-emerald-300">รอบเช็คชื่อวันนี้เปิดอยู่แล้ว</p>
                <p className="text-xs text-slate-400 mt-0.5">นักเรียนเช็คอินได้</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-amber-300">ยังไม่ได้เปิดรอบเช็คชื่อวันนี้</p>
                <p className="text-xs text-slate-400 mt-0.5">ปกติระบบเปิดอัตโนมัติเมื่อมีนักเรียนเช็คอินคนแรก · กดปุ่มนี้เพื่อเปิดรอบล่วงหน้าได้เอง</p>
              </div>
              <button disabled={pending} onClick={() => run(openTodaySession)} className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]">
                + เปิดรอบเช็คชื่อวันนี้
              </button>
            </div>
          )}
        </div>
        <form
          action={(formData) => run(() => updateSystemSettings(formData))}
          className="space-y-6"
        >
          <div className="grid grid-cols-3 gap-3">
            <label>
              <span className="block text-xs font-semibold text-slate-400 mb-2">เริ่มเช็คเวลา (Start)</span>
              <input type="time" name="check_start" required defaultValue={settings.check_start.slice(0, 5)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </label>
            <label>
              <span className="block text-xs font-semibold text-slate-400 mb-2">บันทึกสาย (Late)</span>
              <input type="time" name="late_after" required defaultValue={settings.late_after.slice(0, 5)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </label>
            <label>
              <span className="block text-xs font-semibold text-slate-400 mb-2">สิ้นสุดการเข้าแถวเวลา (End)</span>
              <input type="time" name="check_end" required defaultValue={settings.check_end.slice(0, 5)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </label>
          </div>
          <button type="submit" disabled={pending} className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]">
            บันทึกการตั้งค่า
          </button>
        </form>
      </section>

      {/* Holidays */}
      <section className={`col-start-1 row-start-1 ${activeTab === "holidays" ? "visible" : "invisible pointer-events-none"} glass-panel rounded-2xl p-8 shadow-2xl relative`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-white">วันหยุด</h2>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">📅 วันหยุด</span>
        </div>
        <p className="text-slate-400 text-sm mb-6">เพิ่มวันหยุดพิเศษเพื่อไม่บันทึกการขาดเข้าแถวในวันนั้น</p>
        <form action={(formData) => run(() => addHoliday(formData))} className="flex flex-col sm:flex-row gap-3 mb-6">
          <input type="date" name="holiday_date" required className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          <input name="holiday_name" placeholder="ชื่อวันหยุด เช่น วันมาฆบูชา" required className="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
          <button type="submit" disabled={pending} className="shrink-0 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-5 rounded-xl transition-all active:scale-[0.98]">
            + เพิ่ม
          </button>
        </form>
        <ul className="divide-y divide-slate-900/60 border border-slate-900 rounded-xl overflow-y-auto max-h-72">
          {holidays.length === 0 && <li className="px-4 py-6 text-center text-slate-500 text-sm">ยังไม่มีวันหยุดที่จะถึงในรายการ</li>}
          {holidays.map((h) => (
            <li key={h.dateStr} className="flex items-center justify-between px-4 py-3 bg-slate-950/30">
              <div>
                <span className="text-sm font-semibold text-white">{h.name}</span>
                <span className="block text-xs text-slate-500 font-mono">{h.label}</span>
              </div>
              <button
                disabled={pending}
                onClick={() => run(() => deleteHoliday(h.dateStr))}
                className="text-rose-400 hover:text-rose-300 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-all"
              >
                ลบ
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Check-in locations */}
      <section className={`col-start-1 row-start-1 ${activeTab === "locations" ? "visible" : "invisible pointer-events-none"} glass-panel rounded-2xl p-8 shadow-2xl relative`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-white">จุดเข้าแถว (ห้อง ม.{roomName})</h2>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">📍 หลายจุด</span>
        </div>
        <p className="text-slate-400 text-sm mb-4">ตั้งได้หลายจุด แล้ว <strong className="text-cyan-300">เลือกจุดที่ใช้งาน</strong> การเช็คอินจะคำนวณระยะเทียบจุดที่เลือกทันที</p>
        <button
          type="button"
          onClick={openAddLocation}
          className="w-full mb-5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2.5 px-4 rounded-xl transition-all active:scale-[0.98]"
        >
          + เพิ่มจุดใหม่
        </button>
        {locations.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-4 mb-4">ยังไม่มีจุดเข้าแถว กดปุ่ม “+ เพิ่มจุดใหม่” ด้านบน</div>
        ) : (
          <div className="space-y-3 mb-6 overflow-y-auto max-h-72 pr-1">
            {locations.map((loc) => (
              <div key={loc.id} className={`rounded-xl border ${loc.isActive ? "bg-cyan-500/5 border-cyan-500/30" : "bg-slate-950/30 border-slate-900"}`}>
                <div className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white truncate">{loc.name}</span>
                      {loc.isActive && <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">ใช้งานอยู่</span>}
                    </div>
                    <span className="block text-[11px] text-slate-500 font-mono mt-0.5">{loc.lat}, {loc.lng} · รัศมี {loc.radius} ม.</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!loc.isActive && (
                      <button disabled={pending} onClick={() => run(() => setActiveLocation(loc.id))} className="bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95">
                        ใช้จุดนี้
                      </button>
                    )}
                    <button onClick={() => openEditLocation(loc.id)} className="text-amber-300 hover:text-amber-200 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-all">
                      แก้ไข
                    </button>
                    <button disabled={pending} onClick={() => run(() => deleteLocation(loc.id))} className="text-rose-400 hover:text-rose-300 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-all">
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Account: change own password */}
      <section className={`col-start-1 row-start-1 ${activeTab === "account" ? "visible" : "invisible pointer-events-none"} glass-panel rounded-2xl p-8 shadow-2xl relative`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-white">บัญชีของฉัน</h2>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">🔑 รหัสผ่าน</span>
        </div>
        <p className="text-slate-400 text-sm mb-6">เปลี่ยนรหัสผ่านสำหรับเข้าสู่ระบบของคุณ (ครูที่ปรึกษา)</p>
        <form ref={passwordFormRef} action={submitPasswordChange} className="space-y-4 max-w-md">
          <label className="block">
            <span className="block text-sm font-medium text-slate-400 mb-2">รหัสผ่านปัจจุบัน</span>
            <div className="relative">
              <input
                type={showCurrentPw ? "text" : "password"}
                name="current_pw"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 pr-11 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button type="button" onClick={() => setShowCurrentPw((v) => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-300">
                {showCurrentPw ? "🙈" : "👁️"}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-400 mb-2">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</span>
            <div className="relative">
              <input
                type={showNewPw ? "text" : "password"}
                name="new_pw"
                required
                minLength={6}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 pr-11 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button type="button" onClick={() => setShowNewPw((v) => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-300">
                {showNewPw ? "🙈" : "👁️"}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-400 mb-2">ยืนยันรหัสผ่านใหม่</span>
            <div className="relative">
              <input
                type={showConfirmPw ? "text" : "password"}
                name="confirm_pw"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 pr-11 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <button type="button" onClick={() => setShowConfirmPw((v) => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-300">
                {showConfirmPw ? "🙈" : "👁️"}
              </button>
            </div>
          </label>
          <button type="submit" disabled={pending} className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]">
            เปลี่ยนรหัสผ่าน
          </button>
        </form>
      </section>
      </div>
      </div>

      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeLocationModal}>
          <div
            className="glass-panel rounded-2xl p-6 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">{editingLocationId ? "แก้ไขจุดเข้าแถว" : "เพิ่มจุดเข้าแถวใหม่"}</h3>
              <button type="button" onClick={closeLocationModal} className="text-slate-400 hover:text-slate-200 text-xl leading-none">✕</button>
            </div>
            <form
              key={editingLocationId ?? "new"}
              action={(formData) => {
                if (editingLocationId) run(() => editLocation(editingLocationId, formData));
                else run(() => addLocation(formData));
                closeLocationModal();
              }}
              className="space-y-2.5"
            >
              <input name="loc_name" defaultValue={editingLocation?.name} placeholder="ชื่อจุด" required className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
              <div className="grid grid-cols-3 gap-2">
                <input ref={locLatRef} name="loc_lat" defaultValue={editingLocation?.lat} placeholder="ละติจูด" required className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                <input ref={locLngRef} name="loc_lng" defaultValue={editingLocation?.lng} placeholder="ลองจิจูด" required className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
                <input name="loc_radius" type="number" defaultValue={editingLocation?.radius} placeholder="รัศมี (ม.)" required className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
              </div>
              <button
                type="button"
                disabled={gpsBusy}
                onClick={useGpsForLocationForm}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-cyan-300 text-xs font-semibold py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <span>{gpsStatus?.icon ?? "📡"}</span>
                <span>{gpsStatus?.text ?? "ดึงตำแหน่งปัจจุบัน (ยืนที่จุดนั้นแล้วกด)"}</span>
              </button>
              <div className="flex gap-2">
                <button type="submit" disabled={pending} className="flex-grow bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-all active:scale-95">
                  {editingLocationId ? "บันทึกการแก้ไข" : "เพิ่มจุด"}
                </button>
                <button type="button" onClick={closeLocationModal} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold px-4 py-2.5 rounded-lg">
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </main>
    </TeacherShell>
  );
}

function TabButton({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: "indigo" | "cyan" | "sky";
  children: React.ReactNode;
}) {
  const activeClass =
    color === "cyan"
      ? "bg-cyan-500/15 border-cyan-500/30 text-white"
      : color === "sky"
        ? "bg-sky-500/15 border-sky-500/30 text-white"
        : "bg-indigo-500/15 border-indigo-500/30 text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tab-btn text-sm font-semibold px-4 py-2 rounded-xl border transition-all ${active ? activeClass : "bg-slate-900 border-slate-800 text-slate-400"}`}
    >
      {children}
    </button>
  );
}
