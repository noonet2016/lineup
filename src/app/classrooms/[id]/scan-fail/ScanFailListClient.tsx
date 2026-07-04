"use client";

import { TeacherShell } from "@/app/_components/LegacyChrome";
import type { UnmatchedScanFailReport } from "@/lib/actions/scanfail";

type Props = {
  classroomId: number;
  roomName: string;
  fullName: string;
  reports: UnmatchedScanFailReport[];
  todayLabel: string;
};

export default function ScanFailListClient({ classroomId, roomName, fullName, reports, todayLabel }: Props) {
  return (
    <TeacherShell active="dashboard" fullName={fullName} roomName={roomName} classroomId={classroomId}>
      <main className="max-w-5xl mx-auto safe-px py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl sm:text-3xl font-extrabold text-white">📷 รายงานสแกนหน้าไม่ติด</h1>
          <p className="text-slate-400 text-sm">แจ้งสแกนหน้าไม่ติด แต่ยังไม่ได้เช็คชื่อเข้าแถว</p>
          <p className="text-xs text-slate-500">📅 {todayLabel}</p>
        </div>

        <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
          {reports.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-10">ไม่มีรายการ</div>
          ) : (
            <ul className="divide-y divide-slate-900/60 border border-slate-900 rounded-xl overflow-hidden">
              {reports.map((report) => {
                const studentLabel = `${report.numberInClass ?? "-"}. ${report.fullName}${report.nickname ? ` (${report.nickname})` : ""}`;
                const mapsUrl =
                  report.latitude !== null && report.longitude !== null
                    ? `https://www.google.com/maps?q=${report.latitude},${report.longitude}`
                    : null;

                return (
                  <li key={report.studentId} className="bg-slate-950/30 px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{studentLabel}</p>
                        {report.outsideRadius ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-300">
                            ⚠️ นอกรัศมี ~{report.distanceMeters} ม. (กำหนด {report.radius} ม.)
                          </span>
                        ) : report.latitude !== null && report.longitude !== null ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                            📍 ในรัศมี{report.distanceMeters !== null ? ` ~${report.distanceMeters} ม.` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-500/10 border border-slate-500/20 text-slate-400">
                            📍 ไม่มีพิกัด
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">แจ้งเวลา {report.reportedAt}</p>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors w-fit"
                        >
                          เปิดพิกัดบน Google Maps
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </TeacherShell>
  );
}
