"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import { PopupAlertModal } from "@/app/_components/PopupAlert";
import { addExemption, deleteExemption, toggleExemptionActive } from "@/lib/actions/exemptions";
import { LightboxProvider } from "@/app/_components/ImageLightbox";
import StudentAvatar from "@/app/_components/StudentAvatar";

const WEEKDAY_LABEL: Record<number, string> = { 1: "จันทร์", 2: "อังคาร", 3: "พุธ", 4: "พฤหัสบดี", 5: "ศุกร์", 6: "เสาร์", 7: "อาทิตย์" };

type StudentOpt = { studentId: string; fullName: string; nickname: string | null; numberInClass: number | null; photoUrl: string | null };
type Exemption = {
  id: number;
  studentId: string;
  studentName: string;
  nickname: string | null;
  numberInClass: number | null;
  photoUrl: string | null;
  reason: string;
  weekday: number | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
};

export default function ExemptionsClient({
  classroomId,
  roomName,
  fullName,
  students,
  exemptions,
  todayLabel,
  adminBack,
  viewAll,
  selectedDate,
  selectedDateLabel,
  todayDate,
  totalCount,
}: {
  classroomId: number;
  roomName: string;
  fullName: string;
  students: StudentOpt[];
  exemptions: Exemption[];
  todayLabel: string;
  adminBack: boolean;
  viewAll: boolean;
  selectedDate: string;
  selectedDateLabel: string;
  todayDate: string;
  totalCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [exemptWeekday, setExemptWeekday] = useState("today");
  const [query, setQuery] = useState("");
  const [pickedId, setPickedId] = useState("");
  const picked = students.find((s) => s.studentId === pickedId) ?? null;

  const visibleExemptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exemptions;
    return exemptions.filter((e) =>
      e.studentName.toLowerCase().includes(q) ||
      (e.nickname ? e.nickname.toLowerCase().includes(q) : false) ||
      e.studentId.toLowerCase().includes(q) ||
      (e.numberInClass !== null && String(e.numberInClass).includes(q)) ||
      e.reason.toLowerCase().includes(q),
    );
  }, [exemptions, query]);

  const base = `/classrooms/${classroomId}/exemptions`;
  function navigateToDate(date: string) {
    router.push(`${base}?date=${date}`);
  }
  function shiftDate(days: number) {
    const date = new Date(`${selectedDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    navigateToDate(date.toISOString().slice(0, 10));
  }

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setBanner(null);
    startTransition(async () => {
      const result = await action();
      setBanner({ text: result.message, kind: result.ok ? "success" : "error" });
      router.refresh();
    });
  }

  return (
    <TeacherShell active="exemptions" fullName={fullName} roomName={roomName} classroomId={classroomId} adminBack={adminBack}>
      <LightboxProvider>
      <main className="max-w-full mx-auto safe-px py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white">🎌 ยกเว้นเข้าแถว</h1>
          <p className="text-slate-400 text-sm mt-1">ห้องที่ปรึกษา ม.{roomName}</p>
        </div>
        <PopupAlertModal alert={banner ? { type: banner.kind, message: banner.text } : null} onClose={() => setBanner(null)} />

        <div className="grid lg:grid-cols-2 gap-6 items-stretch">
        <section className="min-w-0 glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col">
          <h2 className="text-lg font-bold text-white mb-5">เพิ่มการยกเว้น</h2>
          <form action={(formData) => run(() => addExemption(classroomId, formData))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">นักเรียน</label>
              <select name="student_id" required value={pickedId} onChange={(e) => setPickedId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50">
                <option value="">— เลือกนักเรียน —</option>
                {students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    เลขที่ {s.numberInClass ?? "-"} · {s.fullName} · เลขประจำตัว {s.studentId}{s.nickname ? ` · ชื่อเล่น ${s.nickname}` : ""}
                  </option>
                ))}
              </select>
              {picked && (
                <div className="mt-3 flex items-center gap-4 rounded-xl border border-sky-500/25 bg-sky-500/5 p-3">
                  <StudentAvatar student={picked} className="w-16 h-16" initialClassName="text-xl" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white break-words">{picked.fullName}</p>
                    <p className="text-sm text-slate-300">
                      เลขที่ {picked.numberInClass ?? "-"}
                      {picked.nickname ? ` · ชื่อเล่น ${picked.nickname}` : ""}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">เลขประจำตัว {picked.studentId}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">เหตุผล</label>
                <input name="reason" placeholder="เช่น ร.ด. / นางรำ / วงโปงลาง" required className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">มีผลวัน</label>
                <select name="weekday" value={exemptWeekday} onChange={(e) => setExemptWeekday(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50">
                  <option value="all">ทุกวันเรียน</option>
                  <option value="today">เฉพาะวันนี้ ({todayLabel})</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>เฉพาะวัน{WEEKDAY_LABEL[n]}</option>
                  ))}
                </select>
              </div>
            </div>
            {exemptWeekday !== "today" && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">เริ่ม (ไม่บังคับ)</label>
                  <input type="date" name="start_date" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">สิ้นสุด (ไม่บังคับ)</label>
                  <input type="date" name="end_date" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                </div>
              </div>
            )}
            <button type="submit" disabled={pending} className="w-full sm:w-auto bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98]">
              + เพิ่มการยกเว้น
            </button>
          </form>
        </section>

        <section className="min-w-0 glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-bold text-white">
              {viewAll ? `รายการยกเว้นทั้งหมด (${totalCount})` : `ยกเว้นวันที่เลือก (${exemptions.length})`}
            </h2>
            <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950/60 p-1 text-sm font-bold">
              <button type="button" onClick={() => navigateToDate(selectedDate)} className={`min-h-9 px-3 rounded-lg ${!viewAll ? "bg-sky-500 text-white" : "text-slate-300 hover:text-white"}`}>ตามวัน</button>
              <button type="button" onClick={() => router.push(`${base}?view=all`)} className={`min-h-9 px-3 rounded-lg ${viewAll ? "bg-sky-500 text-white" : "text-slate-300 hover:text-white"}`}>ทั้งหมด</button>
            </div>
          </div>
          {!viewAll && (
            <div className="mb-4 space-y-2">
              <p className="text-sm text-slate-300">📅 {selectedDateLabel}</p>
              <div className="flex items-stretch gap-2">
                <button type="button" onClick={() => shiftDate(-1)} className="min-h-11 px-4 rounded-xl bg-slate-600 hover:bg-slate-500 active:bg-slate-700 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-60" aria-label="วันก่อนหน้า">◀</button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    if (event.target.value) navigateToDate(event.target.value);
                  }}
                  className="min-h-11 flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-center text-sm font-semibold text-white [color-scheme:dark] outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                />
                <button type="button" onClick={() => shiftDate(1)} className="min-h-11 px-4 rounded-xl bg-slate-600 hover:bg-slate-500 active:bg-slate-700 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-60" aria-label="วันถัดไป">▶</button>
                <button type="button" disabled={selectedDate === todayDate} onClick={() => navigateToDate(todayDate)} className="min-h-11 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-60">วันนี้</button>
              </div>
            </div>
          )}
          {exemptions.length > 0 && (
            <div className="relative mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="🔍 ค้นหาชื่อ / ชื่อเล่น / รหัส / เลขที่ / เหตุผล"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          {exemptions.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-6">{viewAll ? "ยังไม่มีนักเรียนที่ยกเว้น" : "ไม่มีนักเรียนที่ได้รับการยกเว้นในวันที่เลือก"}</div>
          ) : visibleExemptions.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-6">ไม่พบรายการที่ตรงกับคำค้นหา</div>
          ) : (
            <ul className="flex-grow divide-y divide-slate-900/60 border border-slate-900 rounded-xl overflow-y-auto max-h-[60vh]">
              {visibleExemptions.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-950/30">
                  <StudentAvatar student={{ fullName: e.studentName, nickname: e.nickname, numberInClass: e.numberInClass, photoUrl: e.photoUrl }} className="w-10 h-10" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">
                      เลขที่ {e.numberInClass ?? "-"} · {e.studentName}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">เลขประจำตัว {e.studentId}</div>
                    {e.nickname && <div className="text-xs text-slate-400">ชื่อเล่น {e.nickname}</div>}
                    <div className="text-xs text-slate-400 mt-0.5">
                      <span className="text-sky-400">🎌 {e.reason}</span> ·{" "}
                      {e.weekday ? `ทุกวัน${WEEKDAY_LABEL[e.weekday]}` : e.startDate === e.endDate && e.startDate ? `วันที่ ${e.startDate}` : "ทุกวันเรียน"}
                      {e.startDate && e.endDate && e.startDate !== e.endDate ? ` (${e.startDate} ถึง ${e.endDate})` : ""}
                      {!e.isActive && " · ปิดใช้งาน"}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs shrink-0">
                    <button disabled={pending} onClick={() => run(() => toggleExemptionActive(classroomId, e.id, !e.isActive))} className="text-slate-400 hover:text-white">
                      {e.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                    <button disabled={pending} onClick={() => run(() => deleteExemption(classroomId, e.id))} className="text-rose-400 hover:text-rose-300">
                      ลบ
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
      </main>
      </LightboxProvider>
    </TeacherShell>
  );
}
