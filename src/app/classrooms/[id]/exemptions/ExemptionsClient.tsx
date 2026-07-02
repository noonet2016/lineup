"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import { addExemption, deleteExemption, toggleExemptionActive } from "@/lib/actions/exemptions";

const WEEKDAY_LABEL: Record<number, string> = { 1: "จันทร์", 2: "อังคาร", 3: "พุธ", 4: "พฤหัสบดี", 5: "ศุกร์", 6: "เสาร์", 7: "อาทิตย์" };

type StudentOpt = { studentId: string; fullName: string; nickname: string | null; numberInClass: number | null };
type Exemption = {
  id: number;
  studentId: string;
  studentName: string;
  nickname: string | null;
  numberInClass: number | null;
  reason: string;
  weekday: number | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
};

function Banner({ text, kind }: { text: string; kind: "success" | "error" }) {
  return (
    <div
      className={`p-3 rounded-xl text-sm border ${kind === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}
    >
      {text}
    </div>
  );
}

export default function ExemptionsClient({
  classroomId,
  roomName,
  fullName,
  students,
  exemptions,
  todayLabel,
}: {
  classroomId: number;
  roomName: string;
  fullName: string;
  students: StudentOpt[];
  exemptions: Exemption[];
  todayLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [exemptWeekday, setExemptWeekday] = useState("today");

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setBanner(null);
    startTransition(async () => {
      const result = await action();
      setBanner({ text: result.message, kind: result.ok ? "success" : "error" });
      router.refresh();
    });
  }

  return (
    <TeacherShell active="exemptions" fullName={fullName} roomName={roomName} classroomId={classroomId}>
      <main className="max-w-6xl mx-auto safe-px py-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white">🎌 ยกเว้นเข้าแถว</h1>
          <p className="text-slate-400 text-sm mt-1">ห้องที่ปรึกษา ม.{roomName}</p>
        </div>
        {banner && <div className="max-w-3xl mx-auto"><Banner text={banner.text} kind={banner.kind} /></div>}

        <div className="grid lg:grid-cols-2 gap-6 items-stretch">
        <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col">
          <h2 className="text-lg font-bold text-white mb-5">เพิ่มการยกเว้น</h2>
          <form action={(formData) => run(() => addExemption(formData))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">นักเรียน</label>
              <select name="student_id" required className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50">
                <option value="">— เลือกนักเรียน —</option>
                {students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    เลขที่ {s.numberInClass ?? "-"} · {s.fullName} · เลขประจำตัว {s.studentId}{s.nickname ? ` · ชื่อเล่น ${s.nickname}` : ""}
                  </option>
                ))}
              </select>
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
                  <label className="block text-xs font-medium text-slate-500 mb-2">เริ่ม (ไม่บังคับ)</label>
                  <input type="date" name="start_date" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">สิ้นสุด (ไม่บังคับ)</label>
                  <input type="date" name="end_date" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
                </div>
              </div>
            )}
            <button type="submit" disabled={pending} className="w-full sm:w-auto bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-sky-500/20 transition-all active:scale-[0.98]">
              + เพิ่มการยกเว้น
            </button>
          </form>
        </section>

        <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col">
          <h2 className="text-lg font-bold text-white mb-4">รายการยกเว้น ({exemptions.length})</h2>
          {exemptions.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-6">ยังไม่มีนักเรียนที่ยกเว้น</div>
          ) : (
            <ul className="flex-grow divide-y divide-slate-900/60 border border-slate-900 rounded-xl overflow-y-auto max-h-[60vh]">
              {exemptions.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-950/30">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      เลขที่ {e.numberInClass ?? "-"} · {e.studentName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">เลขประจำตัว {e.studentId}{e.nickname ? ` · ชื่อเล่น ${e.nickname}` : ""}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      <span className="text-sky-400">🎌 {e.reason}</span> ·{" "}
                      {e.weekday ? `ทุกวัน${WEEKDAY_LABEL[e.weekday]}` : e.startDate === e.endDate && e.startDate ? `วันที่ ${e.startDate}` : "ทุกวันเรียน"}
                      {e.startDate && e.endDate && e.startDate !== e.endDate ? ` (${e.startDate} ถึง ${e.endDate})` : ""}
                      {!e.isActive && " · ปิดใช้งาน"}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs shrink-0">
                    <button disabled={pending} onClick={() => run(() => toggleExemptionActive(e.id, !e.isActive))} className="text-slate-400 hover:text-white">
                      {e.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                    <button disabled={pending} onClick={() => run(() => deleteExemption(e.id))} className="text-rose-400 hover:text-rose-300">
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
    </TeacherShell>
  );
}
