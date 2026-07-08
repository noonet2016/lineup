"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import { LightboxProvider, LightboxThumb } from "@/app/_components/ImageLightbox";
import { acknowledgeScanFail, type UnmatchedScanFailReport } from "@/lib/actions/scanfail";
import { dashBadge, type DashboardStatus } from "@/lib/dashboardBadge";

type Props = {
  classroomId: number;
  roomName: string;
  fullName: string;
  reports: UnmatchedScanFailReport[];
  todayLabel: string;
  selectedDate: string;
  todayDate: string;
  isToday: boolean;
};

export default function ScanFailListClient({
  classroomId,
  roomName,
  fullName,
  reports,
  todayLabel,
  selectedDate,
  todayDate,
  isToday,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigateToDate(date: string) {
    router.push(`/classrooms/${classroomId}/scan-fail?date=${date}`);
  }

  function shiftDate(days: number) {
    const date = new Date(`${selectedDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    const nextDate = date.toISOString().slice(0, 10);
    if (nextDate <= todayDate) navigateToDate(nextDate);
  }

  function handleAck(studentId: string, acknowledged: boolean) {
    startTransition(async () => {
      await acknowledgeScanFail(studentId, acknowledged, selectedDate);
      router.refresh();
    });
  }

  function attendanceBadge(report: UnmatchedScanFailReport): { text: string; className: string } {
    if (!report.checkedInAt) {
      return { text: "⚠️ ยังไม่เช็คชื่อ", className: "bg-rose-500 text-white" };
    }

    if (report.attendanceStatus === "late") {
      const badge = dashBadge(report.attendanceStatus as DashboardStatus);
      return { text: `${badge.text} ${report.checkedInAt}`, className: "bg-amber-500 text-white" };
    }

    return { text: `✓ เช็คชื่อแล้ว ${report.checkedInAt}`, className: "bg-emerald-500 text-white" };
  }

  return (
    <TeacherShell active="dashboard" fullName={fullName} roomName={roomName} classroomId={classroomId}>
      <LightboxProvider>
      <main className="max-w-full mx-auto safe-px py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl sm:text-3xl font-extrabold text-white">📷 รายงานสแกนหน้าไม่ติด</h1>
          <p className="text-slate-400 text-sm">แจ้งสแกนหน้าไม่ติด แต่ยังไม่ได้เช็คชื่อเข้าแถว</p>
          <p className="text-xs text-slate-500">📅 {todayLabel}</p>
        </div>

        <section className="glass-panel rounded-2xl p-4 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="min-h-11 px-4 rounded-xl bg-slate-600 hover:bg-slate-500 active:bg-slate-700 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
              aria-label="วันก่อนหน้า"
            >
              ◀
            </button>
            <input
              type="date"
              value={selectedDate}
              max={todayDate}
              onChange={(event) => {
                if (event.target.value) navigateToDate(event.target.value);
              }}
              className="min-h-11 rounded-xl border border-slate-700 bg-slate-950/70 px-4 text-center text-sm font-semibold text-white [color-scheme:dark] outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            />
            <button
              type="button"
              disabled={isToday}
              onClick={() => shiftDate(1)}
              className="min-h-11 px-4 rounded-xl bg-slate-600 hover:bg-slate-500 active:bg-slate-700 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
              aria-label="วันถัดไป"
            >
              ▶
            </button>
            <button
              type="button"
              disabled={isToday}
              onClick={() => navigateToDate(todayDate)}
              className="min-h-11 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
            >
              วันนี้
            </button>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
          {reports.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-10">ไม่มีรายการ</div>
          ) : (
            <ul className="divide-y divide-slate-900/60">
              {reports.map((report) => {
                const studentLabel = `${report.numberInClass ?? "-"}. ${report.fullName}${report.nickname ? ` (${report.nickname})` : ""}`;
                // q=lat,lng(Label) shows a named marker. Google may fall back to the
                // reverse-geocoded address on some clients, but where supported it labels
                // the pin with the student's name. Encode to keep Thai/spaces intact.
                const mapLabel = `${report.fullName}${report.nickname ? ` (${report.nickname})` : ""}`;
                const mapsUrl =
                  report.latitude !== null && report.longitude !== null
                    ? `https://www.google.com/maps?q=${report.latitude},${report.longitude}(${encodeURIComponent(mapLabel)})`
                    : null;

                const initial = report.fullName.trim().slice(0, 1) || "?";
                const attendance = attendanceBadge(report);

                return (
                  <li key={report.studentId} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      {report.linePictureUrl ? (
                        <LightboxThumb
                          src={report.linePictureUrl}
                          alt={report.fullName}
                          caption={studentLabel}
                          className="w-11 h-11 border border-slate-700"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full shrink-0 bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center text-white text-base font-bold">
                          {initial}
                        </div>
                      )}
                      <div className="flex flex-col gap-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{studentLabel}</p>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${attendance.className}`}>
                          {attendance.text}
                        </span>
                        {report.outsideRadius ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-500 text-white">
                            ⚠️ นอกรัศมี ~{report.distanceMeters} ม. (กำหนด {report.radius} ม.)
                          </span>
                        ) : report.latitude !== null && report.longitude !== null ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500 text-white">
                            📍 ในรัศมี{report.distanceMeters !== null ? ` ~${report.distanceMeters} ม.` : ""}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500 text-white">
                            📍 ไม่มีพิกัด
                          </span>
                        )}
                      </div>
                      {report.lineDisplayName && (
                        <p className="text-[11px] text-slate-400">
                          <span className="text-emerald-400 font-semibold">LINE:</span> {report.lineDisplayName}
                        </p>
                      )}
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
                      <div className="pt-1">
                        {report.acknowledgedAt ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                              ✓ รับทราบแล้ว · {report.acknowledgedAt} น.
                            </span>
                            <button
                              disabled={pending}
                              onClick={() => handleAck(report.studentId, false)}
                              className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-60"
                            >
                              ยกเลิกรับทราบ
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={pending}
                            onClick={() => handleAck(report.studentId, true)}
                            className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all active:scale-95 disabled:opacity-60"
                          >
                            ✓ รับทราบ (ยืนยันอยู่ในบริเวณ)
                          </button>
                        )}
                      </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
      </LightboxProvider>
    </TeacherShell>
  );
}
