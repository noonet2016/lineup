"use client";

import { useState } from "react";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import { dashBadge } from "@/lib/dashboardBadge";
import type { DashboardStatus } from "@/lib/dashboardBadge";

type DayFilter = "all" | DashboardStatus;

type StudentRow = {
  studentId: string;
  fullName: string;
  nickname: string | null;
  numberInClass: number | null;
  displayStatus: DashboardStatus;
  checkTimeLabel: string;
  distanceM: number | null;
  isSuspicious: boolean;
  editReason: string | null;
  editorName: string | null;
  exemptReason: string | null;
  scanFailBadge: string | null;
};

const LEFT_BORDER: Record<DashboardStatus, string> = {
  present: "border-l-emerald-500",
  late: "border-l-amber-500",
  absent: "border-l-rose-500",
  flagged: "border-l-orange-500",
  pending: "border-l-slate-700",
  excused: "border-l-sky-500",
};

export default function ReportDayClient({
  classroomId,
  roomName,
  fullName,
  sessionDateLabel,
  timeRangeLabel,
  exportHref,
  stats,
  students,
}: {
  classroomId: number;
  roomName: string;
  fullName: string;
  sessionDateLabel: string;
  timeRangeLabel: string;
  exportHref: string;
  stats: { present: number; late: number; absent: number; excused: number; pending: number; flagged: number };
  students: StudentRow[];
}) {
  const [filter, setFilter] = useState<DayFilter>("all");
  const filteredStudents = filter === "all" ? students : students.filter((s) => s.displayStatus === filter);

  return (
    <TeacherShell active="report" fullName={fullName} roomName={roomName} classroomId={classroomId}>
      <main className="max-w-full mx-auto safe-px py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <a href={`/classrooms/${classroomId}/report`} className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1">
              &larr; กลับหน้ารายงาน
            </a>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-3">รายละเอียดการเข้าแถวรายคน</h1>
            <p className="text-slate-400 text-sm mt-1">
              ห้อง ม.{roomName} · วันที่ {sessionDateLabel} · รอบเวลา {timeRangeLabel} น.
            </p>
          </div>
          <a
            href={exportHref}
            className="shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-md text-center flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            ส่งออก CSV วันนี้
          </a>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <StatChip label="มาปกติ" value={stats.present} colorClass="border-l-emerald-500 text-emerald-400 ring-emerald-500/50" active={filter === "present"} onClick={() => setFilter(filter === "present" ? "all" : "present")} />
          <StatChip label="สาย" value={stats.late} colorClass="border-l-amber-500 text-amber-400 ring-amber-500/50" active={filter === "late"} onClick={() => setFilter(filter === "late" ? "all" : "late")} />
          <StatChip label="ขาด" value={stats.absent} colorClass="border-l-rose-500 text-rose-400 ring-rose-500/50" active={filter === "absent"} onClick={() => setFilter(filter === "absent" ? "all" : "absent")} />
          <StatChip label="🎌 ลา/กิจกรรม" value={stats.excused} colorClass="border-l-sky-500 text-sky-400 ring-sky-500/50" active={filter === "excused"} onClick={() => setFilter(filter === "excused" ? "all" : "excused")} />
          <StatChip label="GPS อ่อน" value={stats.pending} colorClass="border-l-slate-500 text-slate-300 ring-slate-500/50" active={filter === "pending"} onClick={() => setFilter(filter === "pending" ? "all" : "pending")} />
          <StatChip label="นอกรัศมี" value={stats.flagged} colorClass="border-l-orange-500 text-orange-400 ring-orange-500/50" active={filter === "flagged"} onClick={() => setFilter(filter === "flagged" ? "all" : "flagged")} />
        </div>
        {filter !== "all" && (
          <button type="button" onClick={() => setFilter("all")} className="text-xs text-slate-400 hover:text-white transition-colors -mt-3">
            ✕ ล้างตัวกรอง (แสดง {dashBadge(filter).text})
          </button>
        )}

        <div className="hidden md:block glass-panel rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-auto max-h-[65vh]">
            <table className="min-w-full divide-y divide-slate-900 text-left text-sm">
              <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-xs sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-bold">เลขที่</th>
                  <th className="px-6 py-4 font-bold">รหัส</th>
                  <th className="px-6 py-4 font-bold">ชื่อ - นามสกุล</th>
                  <th className="px-6 py-4 font-bold">สถานะ</th>
                  <th className="px-6 py-4 font-bold">เวลาเช็ค</th>
                  <th className="px-6 py-4 font-bold text-center">ระยะห่าง (ม.)</th>
                  <th className="px-6 py-4 font-bold text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/40">
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      ไม่มีรายชื่อนักเรียนในหัวข้อตัวกรองนี้
                    </td>
                  </tr>
                )}
                {filteredStudents.map((st) => {
                  const badge = dashBadge(st.displayStatus);
                  return (
                    <tr key={st.studentId} className="hover:bg-slate-900/10 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">{st.numberInClass ?? "-"}</td>
                      <td className="px-6 py-4 text-slate-400 font-mono">{st.studentId}</td>
                      <td className="px-6 py-4 text-white font-semibold">
                        {st.fullName}
                        {st.nickname && <span className="text-slate-400 font-normal"> ({st.nickname})</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}>{badge.text}</span>
                        {st.exemptReason && (
                          <span className="block text-[10px] text-sky-400 mt-1">🎌 {st.exemptReason}</span>
                        )}
                        {st.editReason && (
                          <span className="block text-[10px] text-indigo-400 mt-1" title={st.editReason}>
                            📝 แก้โดย {st.editorName ?? "ครู"}
                          </span>
                        )}
                        {st.scanFailBadge && (
                          <span className="block w-fit mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-400/15 border border-amber-400/50 text-amber-300">
                            {st.scanFailBadge}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-mono">{st.checkTimeLabel}</td>
                      <td className="px-6 py-4 text-center text-slate-400 font-mono">
                        {st.distanceM ?? "-"}
                        {st.isSuspicious && (
                          <span className="text-rose-500 ml-1" title="นอกรัศมี">⚠️</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <a
                          href={`/classrooms/${classroomId}/students/${st.studentId}/edit`}
                          className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-400 px-3 py-1.5 rounded-lg text-xs transition-colors"
                        >
                          แก้ไขสถานะ
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="block md:hidden space-y-4 max-h-[65vh] overflow-y-auto pr-1">
          {filteredStudents.length === 0 && (
            <div className="glass-panel p-8 text-center text-slate-500 rounded-2xl">ไม่มีรายชื่อนักเรียนในหัวข้อตัวกรองนี้</div>
          )}
          {filteredStudents.map((st) => {
            const badge = dashBadge(st.displayStatus);
            return (
              <div key={st.studentId} className={`glass-panel p-4 rounded-2xl border-l-4 ${LEFT_BORDER[st.displayStatus]} flex flex-col gap-3`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-400 font-bold text-sm shrink-0">
                      {st.numberInClass ?? "-"}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white leading-tight">
                        {st.fullName}
                        {st.nickname && <span className="text-slate-400 font-normal"> ({st.nickname})</span>}
                      </h4>
                      <span className="text-[10px] text-slate-500 font-mono">รหัส: {st.studentId}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.className}`}>{badge.text}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900/50">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">เวลาเช็ค</span>
                    <span className="text-slate-300 font-mono">{st.checkTimeLabel}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-500 block text-[9px] uppercase">ระยะห่าง</span>
                    <span className="text-slate-300 font-mono">
                      {st.distanceM !== null ? `${st.distanceM} ม.` : "-"}
                      {st.isSuspicious && <span className="text-rose-500 ml-1">⚠️</span>}
                    </span>
                  </div>
                  <div className="text-right">
                    <a
                      href={`/classrooms/${classroomId}/students/${st.studentId}/edit`}
                      className="inline-block bg-slate-900 border border-slate-800 hover:border-indigo-500/45 text-indigo-400 font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all"
                    >
                      แก้ไข
                    </a>
                  </div>
                </div>
                {st.exemptReason && (
                  <div className="text-[10px] text-sky-400 bg-sky-500/5 px-2.5 py-1.5 rounded-lg border border-sky-500/10">
                    🎌 ลา/กิจกรรม: {st.exemptReason}
                  </div>
                )}
                {st.editReason && (
                  <div className="text-[10px] text-indigo-400 bg-indigo-500/5 px-2.5 py-1.5 rounded-lg border border-indigo-500/10">
                    📝 แก้โดย {st.editorName ?? "ครู"}: {st.editReason}
                  </div>
                )}
                {st.scanFailBadge && (
                  <div className="text-[10px] text-amber-300 bg-amber-400/10 px-2.5 py-1.5 rounded-lg border border-amber-400/30 font-bold">
                    {st.scanFailBadge}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </TeacherShell>
  );
}

function StatChip({
  label,
  value,
  colorClass,
  active,
  onClick,
}: {
  label: string;
  value: number;
  colorClass: string;
  active: boolean;
  onClick: () => void;
}) {
  const [border, text, ring] = colorClass.split(" ");
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glass-panel p-3.5 rounded-2xl border-l-4 ${border} text-left w-full transition-all hover:bg-slate-900/30 ${active ? `ring-2 ${ring}` : ""}`}
    >
      <span className="text-xs text-slate-400 block mb-1">{label}</span>
      <span className={`text-2xl font-extrabold ${text}`}>{value}</span>
    </button>
  );
}
