"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/app/_components/LegacyChrome";
import { LightboxProvider, LightboxThumb } from "@/app/_components/ImageLightbox";
import { PopupAlertModal, usePopupAlert } from "@/app/_components/PopupAlert";
import { acknowledgeScanFail, type UnmatchedScanFailReport } from "@/lib/actions/scanfail";

type Props = {
  classroomId: number;
  roomName: string;
  fullName: string;
  reports: UnmatchedScanFailReport[];
  todayLabel: string;
};

export default function ScanFailListClient({ classroomId, roomName, fullName, reports, todayLabel }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { alert, setAlert, showResult } = usePopupAlert();

  function handleAck(studentId: string, acknowledged: boolean) {
    startTransition(async () => {
      const result = await acknowledgeScanFail(studentId, acknowledged);
      showResult(result);
      router.refresh();
    });
  }

  return (
    <TeacherShell active="dashboard" fullName={fullName} roomName={roomName} classroomId={classroomId}>
      <LightboxProvider>
      <PopupAlertModal alert={alert} onClose={() => setAlert(null)} />
      <main className="max-w-full mx-auto safe-px py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-xl sm:text-3xl font-extrabold text-white">📷 รายงานสแกนหน้าไม่ติด</h1>
          <p className="text-slate-400 text-sm">แจ้งสแกนหน้าไม่ติด แต่ยังไม่ได้เช็คชื่อเข้าแถว</p>
          <p className="text-xs text-slate-500">📅 {todayLabel}</p>
        </div>

        <section className="glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl">
          {reports.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-10">ไม่มีรายการ</div>
          ) : (
            <ul className="divide-y divide-slate-900/60">
              {reports.map((report) => {
                const studentLabel = `${report.numberInClass ?? "-"}. ${report.fullName}${report.nickname ? ` (${report.nickname})` : ""}`;
                const mapsUrl =
                  report.latitude !== null && report.longitude !== null
                    ? `https://www.google.com/maps?q=${report.latitude},${report.longitude}`
                    : null;

                const initial = report.fullName.trim().slice(0, 1) || "?";

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
