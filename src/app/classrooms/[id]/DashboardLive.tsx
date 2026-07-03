"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { DashboardData, DashboardFilter } from "@/lib/dashboard";
import { dashBadge } from "@/lib/dashboardBadge";
import { fetchDashboardSnapshot } from "@/lib/actions/dashboardLive";
import { addExemption } from "@/lib/actions/exemptions";
import { formatWallClockTime } from "@/lib/time";

const FILTERS: { value: DashboardFilter; label: string; color: string }[] = [
  { value: "present", label: "มาปกติ", color: "border-l-emerald-500 text-emerald-400 ring-emerald-500/50" },
  { value: "late", label: "สาย", color: "border-l-amber-500 text-amber-400 ring-amber-500/50" },
  { value: "absent", label: "ขาด", color: "border-l-rose-500 text-rose-400 ring-rose-500/50" },
  { value: "excused", label: "🎌 ลา/กิจกรรม", color: "border-l-sky-500 text-sky-400 ring-sky-500/50" },
  { value: "edited", label: "📝 แก้ไขโดยครู", color: "border-l-violet-500 text-violet-400 ring-violet-500/50" },
];

/** Client shell for the volatile parts of the teacher dashboard: stat cards, filter counts, roster table/cards. Polls every 30s like legacy's dashboard_data.php AJAX refresh (same filter, no page reload). */
export default function DashboardLive({
  classroomId,
  filter,
  initialData,
  isAdvisor,
  todayLabel,
}: {
  classroomId: number;
  filter: DashboardFilter;
  initialData: DashboardData;
  isAdvisor: boolean;
  todayLabel: string;
}) {
  const [data, setData] = useState(initialData);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [quickLeaveStudent, setQuickLeaveStudent] = useState<{ studentId: string; fullName: string } | null>(null);
  const [quickLeavePending, startQuickLeaveTransition] = useTransition();
  const [quickLeaveError, setQuickLeaveError] = useState<string | null>(null);

  async function refresh() {
    try {
      const snapshot = await fetchDashboardSnapshot(classroomId, filter);
      setData(snapshot);
    } catch {
      // silent — legacy also just skips a beat and retries next tick on network hiccups
    }
  }

  function submitQuickLeave(formData: FormData) {
    setQuickLeaveError(null);
    startQuickLeaveTransition(async () => {
      const result = await addExemption(formData);
      if (!result.ok) {
        setQuickLeaveError(result.message);
        return;
      }
      setQuickLeaveStudent(null);
      refresh();
    });
  }

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    intervalRef.current = setInterval(refresh, 15000);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classroomId, filter]);

  const { students, stats, allCount } = data;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard classroomId={classroomId} filter="present" active={filter === "present"} label="มาปกติ" value={stats.present} colorClass="border-l-emerald-500 text-emerald-400 ring-emerald-500/50" />
        <StatCard classroomId={classroomId} filter="late" active={filter === "late"} label="สาย" value={stats.late} colorClass="border-l-amber-500 text-amber-400 ring-amber-500/50" />
        <StatCard classroomId={classroomId} filter="absent" active={filter === "absent"} label="ขาด" value={stats.absent} colorClass="border-l-rose-500 text-rose-400 ring-rose-500/50" />
        <StatCard classroomId={classroomId} filter="excused" active={filter === "excused"} label="🎌 ลา/กิจกรรม" value={stats.excused} colorClass="border-l-sky-500 text-sky-400 ring-sky-500/50" />
        <StatCard classroomId={classroomId} filter="edited" active={filter === "edited"} label="📝 แก้ไขโดยครู" value={stats.edited} colorClass="border-l-violet-500 text-violet-400 ring-violet-500/50" />
        <StatCard
          classroomId={classroomId}
          filter="pending_review"
          active={filter === "pending_review"}
          label="รวมรอครูตรวจ"
          value={stats.review}
          colorClass="border-l-indigo-500 text-indigo-400 ring-indigo-500/50"
          sub={`GPS อ่อน ${stats.pending} · นอกรัศมี ${stats.flagged}`}
        />
      </div>

      <div className="flex border-b border-slate-900 gap-4">
        <FilterTab classroomId={classroomId} value="all" active={filter === "all"}>
          นักเรียนทั้งหมด ({allCount})
        </FilterTab>
        <FilterTab classroomId={classroomId} value="pending_review" active={filter === "pending_review"}>
          รายการรอตรวจ
          <span className={`bg-indigo-500/10 border border-indigo-500/35 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-bold ${stats.review > 0 ? "" : "hidden"}`}>
            {stats.review}
          </span>
        </FilterTab>
      </div>

      <div className="hidden md:block glass-panel rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-auto max-h-[65vh]">
          <table className="min-w-full divide-y divide-slate-900 text-left text-sm">
            <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-xs sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-bold">เลขที่</th>
                <th className="px-6 py-4 font-bold">รหัสนักเรียน</th>
                <th className="px-6 py-4 font-bold">ชื่อ - นามสกุล</th>
                <th className="px-6 py-4 font-bold">ชื่อเล่น</th>
                <th className="px-6 py-4 font-bold">สถานะ</th>
                <th className="px-6 py-4 font-bold">เวลาบันทึก</th>
                <th className="px-6 py-4 font-bold text-center">ระยะห่าง (เมตร)</th>
                {isAdvisor && <th className="px-6 py-4 font-bold text-right">การจัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/40">
              {students.length === 0 && (
                <tr>
                  <td colSpan={isAdvisor ? 8 : 7} className="px-6 py-12 text-center text-slate-500">
                    ไม่มีรายชื่อนักเรียนในหัวข้อตัวกรองนี้
                  </td>
                </tr>
              )}
              {students.map((student) => {
                const badge = dashBadge(student.displayStatus);
                return (
                  <tr key={student.studentId} className="hover:bg-slate-900/10 transition-colors">
                    <td className="px-6 py-4 text-slate-400 font-medium">{student.numberInClass ?? "-"}</td>
                    <td className="px-6 py-4 text-slate-400 font-mono">{student.studentId}</td>
                    <td className="px-6 py-4 text-white font-semibold">
                      <a href={`/classrooms/${classroomId}/students/${student.studentId}`} className="hover:text-indigo-400">
                        {student.fullName}
                      </a>
                      {student.exemptLabel && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-400/15 border border-amber-400/50 text-amber-300 align-middle">
                          🎌 {student.exemptLabel}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-300">{student.nickname ?? "-"}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}>
                        {badge.text}
                      </span>
                      {student.exemptReason && (
                        <span className="block text-[10px] text-sky-400 mt-1">🎌 {student.exemptReason}</span>
                      )}
                      {student.editReason && (
                        <span className="block text-[10px] text-indigo-400 mt-1">📝 แก้ไขโดยครู: {student.editReason}</span>
                      )}
                      {student.scanFailBadge && (
                        <span className="block w-fit mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-400/15 border border-amber-400/50 text-amber-300">
                          {student.scanFailBadge}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono">{formatWallClockTime(student.checkTime, true)}</td>
                    <td className="px-6 py-4 text-center text-slate-400 font-mono">
                      {student.distanceM ?? "-"}
                      {student.isSuspicious && (
                        <span className="text-rose-500 ml-1" title="อยู่นอกรัศมีที่กำหนด">
                          ⚠️
                        </span>
                      )}
                    </td>
                    {isAdvisor && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!student.exemptReason && (
                            <button
                              type="button"
                              onClick={() => setQuickLeaveStudent({ studentId: student.studentId, fullName: student.fullName })}
                              className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 hover:border-sky-500/40 text-slate-300 hover:text-sky-400 px-3 py-1.5 rounded-lg text-xs transition-colors"
                            >
                              🎌 ลา/กิจกรรม
                            </button>
                          )}
                          <a
                            href={`/classrooms/${classroomId}/students/${student.studentId}/edit`}
                            className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-400 px-3 py-1.5 rounded-lg text-xs transition-colors"
                          >
                            แก้ไขสถานะ
                          </a>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="block md:hidden space-y-4 max-h-[65vh] overflow-y-auto pr-1">
        {students.length === 0 && (
          <div className="glass-panel p-8 text-center text-slate-500 rounded-2xl">ไม่มีรายชื่อนักเรียนในหัวข้อตัวกรองนี้</div>
        )}
        {students.map((student) => {
          const badge = dashBadge(student.displayStatus);
          const leftColor =
            student.displayStatus === "present"
              ? "border-l-emerald-500"
              : student.displayStatus === "late"
                ? "border-l-amber-500"
                : student.displayStatus === "absent"
                  ? "border-l-rose-500"
                  : student.displayStatus === "flagged"
                    ? "border-l-orange-500"
                    : student.displayStatus === "excused"
                      ? "border-l-sky-500"
                      : "border-l-slate-700";
          return (
            <div key={student.studentId} className={`glass-panel p-4 rounded-2xl relative border-l-4 ${leftColor} flex flex-col gap-3`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm shrink-0">
                    {student.numberInClass ?? "-"}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">
                      <a href={`/classrooms/${classroomId}/students/${student.studentId}`} className="hover:text-indigo-400">
                        {student.fullName}
                      </a>
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500 font-mono">รหัส: {student.studentId}</span>
                      {student.nickname && (
                        <span className="text-[9px] text-cyan-400 font-medium px-1.5 py-0.5 rounded bg-cyan-500/10">
                          ชื่อเล่น: {student.nickname}
                        </span>
                      )}
                      {student.exemptLabel && (
                        <span className="text-[10px] text-amber-300 font-bold px-2 py-0.5 rounded-md bg-amber-400/15 border border-amber-400/50">
                          🎌 {student.exemptLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${badge.className}`}>
                  {badge.text}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900/50">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase">เวลาบันทึก</span>
                  <span className="text-slate-300 font-mono">{formatWallClockTime(student.checkTime, true)}</span>
                </div>
                <div className="text-center">
                  <span className="text-slate-500 block text-[9px] uppercase">ระยะห่าง</span>
                  <span className="text-slate-300 font-mono">
                    {student.distanceM !== null ? `${student.distanceM} ม.` : "-"}
                    {student.isSuspicious && <span className="text-rose-500 ml-1">⚠️</span>}
                  </span>
                </div>
                {isAdvisor && (
                  <div className="text-right flex items-center gap-1.5">
                    {!student.exemptReason && (
                      <button
                        type="button"
                        onClick={() => setQuickLeaveStudent({ studentId: student.studentId, fullName: student.fullName })}
                        className="inline-block bg-slate-900 border border-slate-800 hover:border-sky-500/45 text-sky-400 font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all"
                      >
                        🎌 ลา/กิจกรรม
                      </button>
                    )}
                    <a
                      href={`/classrooms/${classroomId}/students/${student.studentId}/edit`}
                      className="inline-block bg-slate-900 border border-slate-800 hover:border-indigo-500/45 text-indigo-400 font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all"
                    >
                      แก้ไขสถานะ
                    </a>
                  </div>
                )}
              </div>
              {student.exemptReason && (
                <div className="text-[10px] text-sky-400 bg-sky-500/5 px-2.5 py-1.5 rounded-lg border border-sky-500/10">
                  🎌 ลา/กิจกรรม: {student.exemptReason}
                </div>
              )}
              {student.editReason && (
                <div className="text-[10px] text-indigo-400 bg-indigo-500/5 px-2.5 py-1.5 rounded-lg border border-indigo-500/10">
                  📝 แก้ไขโดยครู: {student.editReason}
                </div>
              )}
              {student.scanFailBadge && (
                <div className="text-[10px] text-amber-300 bg-amber-400/10 px-2.5 py-1.5 rounded-lg border border-amber-400/30 font-bold">
                  {student.scanFailBadge}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {quickLeaveStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setQuickLeaveStudent(null)}>
          <div className="glass-panel rounded-2xl p-6 shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">🎌 บันทึกลา</h3>
              <button type="button" onClick={() => setQuickLeaveStudent(null)} className="text-slate-400 hover:text-slate-200 text-xl leading-none">✕</button>
            </div>
            <p className="text-sm text-slate-300 mb-1">{quickLeaveStudent.fullName}</p>
            <p className="text-xs text-slate-500 mb-4">เฉพาะวันนี้ ({todayLabel})</p>
            {quickLeaveError && <div className="mb-3 p-2.5 rounded-lg text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400">{quickLeaveError}</div>}
            <form action={submitQuickLeave} className="space-y-3">
              <input type="hidden" name="student_id" value={quickLeaveStudent.studentId} />
              <input type="hidden" name="weekday" value="today" />
              <input
                name="reason"
                placeholder="เหตุผล เช่น ลาป่วย / ลากิจ / ร.ด."
                required
                autoFocus
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
              <div className="flex gap-2">
                <button type="submit" disabled={quickLeavePending} className="flex-grow bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-all active:scale-95">
                  บันทึกลา
                </button>
                <button type="button" onClick={() => setQuickLeaveStudent(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold px-4 py-2.5 rounded-lg">
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({
  classroomId,
  filter,
  active,
  label,
  value,
  colorClass,
  sub,
}: {
  classroomId: number;
  filter: DashboardFilter;
  active: boolean;
  label: string;
  value: number;
  colorClass: string;
  sub?: string;
}) {
  const [border, text, ring] = colorClass.split(" ");
  return (
    <a
      href={`/classrooms/${classroomId}?filter=${filter}`}
      className={`glass-panel p-3.5 sm:p-5 rounded-2xl border-l-4 ${border} block transition-all hover:bg-slate-900/30 ${active ? `ring-2 ${ring}` : ""}`}
    >
      <span className="text-xs text-slate-400 block mb-1">{label}</span>
      <span className={`text-2xl sm:text-3xl font-extrabold ${text}`}>{value}</span>
      {sub && <span className="block text-[10px] text-slate-500 mt-0.5">{sub}</span>}
    </a>
  );
}

function FilterTab({
  classroomId,
  value,
  active,
  children,
}: {
  classroomId: number;
  value: DashboardFilter;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`/classrooms/${classroomId}?filter=${value}`}
      className={`pb-3 text-sm font-semibold transition-all flex items-center gap-1.5 ${
        active ? "text-indigo-400 border-b-2 border-b-indigo-500" : "text-slate-400 hover:text-white"
      }`}
    >
      {children}
    </a>
  );
}
