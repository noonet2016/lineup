"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { locateCheckin, submitCheckin } from "@/lib/checkin";
import { cancelMyScanFail, reportScanFail, type ScanFailGeo } from "@/lib/actions/scanfail";

const STATUS_LABEL: Record<string, string> = {
  present: "มาปกติ",
  late: "สาย",
  pending: "รอตรวจสอบ (สัญญาณพิกัดขัดข้อง)",
  flagged: "รอตรวจสอบ (อยู่นอกรัศมีที่ตั้งไว้)",
};

// Prominent status badge — distinct color per status so "สาย"/"รอตรวจสอบ" stand out.
const STATUS_BADGE: Record<string, { label: string; className: string; icon: string }> = {
  present: { label: "มาปกติ", icon: "✓", className: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" },
  late: { label: "สาย", icon: "⏰", className: "bg-amber-500/15 border-amber-500/40 text-amber-300" },
  pending: { label: "รอตรวจสอบ", icon: "⋯", className: "bg-sky-500/15 border-sky-500/40 text-sky-300" },
  flagged: { label: "รอตรวจสอบ", icon: "⚠", className: "bg-rose-500/15 border-rose-500/40 text-rose-300" },
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const b = STATUS_BADGE[status] ?? { label: status, icon: "•", className: "bg-slate-600/30 border-slate-500/40 text-slate-200" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-base font-bold ${b.className}`}
    >
      <span className="text-lg leading-none">{b.icon}</span>
      สถานะ: {b.label}
    </span>
  );
}

type Props = {
  fullName: string;
  nickname: string | null;
  linePictureUrl: string | null;
  studentId: string;
  roomName: string;
  locationName: string;
  radius: number;
  alreadyCheckedIn: boolean;
  existingStatus: string | null;
  existingCheckTime: string | null;
  scanFailReportedAt: string | null;
  scanFailAcknowledgedAt: string | null;
  scanFailGeo: ScanFailGeo | null;
  holidayName: string | null;
  todayLabel: string;
};

type Step = "locate" | "confirm" | "done";
type Alert = { type: "error" | "success" | "warning"; message: string } | null;

export default function CheckinClient({
  fullName,
  nickname,
  linePictureUrl,
  studentId,
  roomName,
  locationName,
  radius,
  alreadyCheckedIn,
  existingStatus,
  existingCheckTime,
  scanFailReportedAt,
  scanFailAcknowledgedAt,
  scanFailGeo,
  holidayName,
  todayLabel,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(alreadyCheckedIn ? "done" : "locate");
  const [doneStatus, setDoneStatus] = useState<string | null>(existingStatus);
  const [gpsStatus, setGpsStatus] = useState("สถานะ GPS: รอตรวจพิกัด");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanFailPending, startScanFailTransition] = useTransition();
  const [scanFailReported, setScanFailReported] = useState<string | null>(scanFailReportedAt);
  const [scanFailGeoState, setScanFailGeoState] = useState<ScanFailGeo | null>(scanFailGeo);
  const [alert, setAlert] = useState<Alert>(null);

  // Poll for the teacher's acknowledgment so the student sees it without a manual refresh.
  useEffect(() => {
    if (!scanFailReported || scanFailAcknowledgedAt) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 12000);
    return () => clearInterval(id);
  }, [scanFailReported, scanFailAcknowledgedAt, router]);
  const [distance, setDistance] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(120);
  const [completeMessage, setCompleteMessage] = useState<string>(
    alreadyCheckedIn && existingCheckTime
      ? `คุณได้ทำการเช็คชื่อเข้าแถวในวันนี้เรียบร้อยแล้ว<br>สถานะ: <strong>${STATUS_LABEL[existingStatus ?? ""] ?? existingStatus}</strong><br><span class="text-sm text-emerald-400 font-semibold mt-2 block">เมื่อ: ${existingCheckTime}</span>`
      : "",
  );
  const coordsRef = useRef<{ lat: number | null; lng: number | null; accuracy: number | null }>({
    lat: null,
    lng: null,
    accuracy: null,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCountdown() {
    setCountdown(120);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setAlert({ type: "error", message: "ตำแหน่งพิกัดหมดอายุเนื่องจากใช้เวลาเกิน 2 นาที กรุณาระบุพิกัดของคุณใหม่อีกครั้ง" });
          setStep("locate");
          setGpsStatus("สถานะ GPS: รอตรวจพิกัด");
          return 120;
        }
        return c - 1;
      });
    }, 1000);
  }

  const MAX_WAIT_MS = 15000;
  const GOOD_ENOUGH_ACCURACY = 50;

  async function getBestEffortGps() {
    if (!navigator.geolocation) return null;

    return new Promise<{ lat: number; lng: number; accuracy: number } | null>((resolve) => {
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const settle = (value: { lat: number; lng: number; accuracy: number } | null) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        resolve(value);
      };

      timeoutId = setTimeout(() => settle(null), 4000);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          settle({ lat: latitude, lng: longitude, accuracy });
        },
        () => {
          settle(null);
        },
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 },
      );
    });
  }

  async function finishLocating(latitude: number, longitude: number, accuracy: number) {
    coordsRef.current = { lat: latitude, lng: longitude, accuracy };
    setGpsStatus(`พิกัดปัจจุบัน: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}\n(คลาดเคลื่อน ±${Math.round(accuracy)} ม.)`);

    try {
      const result = await locateCheckin(latitude, longitude, accuracy);
      if ("inRadius" in result && result.inRadius) {
        setDistance(result.distance);
        setStep("confirm");
        startCountdown();
      } else if (result.gpsWeak) {
        setAlert({
          type: "error",
          message: `${result.message}<br>กรุณาตรวจสอบว่าเปิดสิทธิ์การเข้าถึงตำแหน่ง (Location Permission) แล้ว และลองออกไปที่โล่งแจ้งเพื่อรับสัญญาณ GPS ที่ดีขึ้น จากนั้นกดเช็คอินใหม่อีกครั้ง`,
        });
      } else {
        setAlert({
          type: "error",
          message: `คุณไม่ได้อยู่ในรัศมีที่กำหนด<br>ระยะปัจจุบันของคุณอยู่ห่างออกไปประมาณ ${result.distance} เมตร (กำหนดรัศมี ${radius} เมตร)`,
        });
      }
    } catch (err) {
      setAlert({ type: "error", message: `ระบบล้มเหลวในการส่งข้อมูลพิกัด: ${err instanceof Error ? err.message : "unknown"}` });
    } finally {
      setLocating(false);
    }
  }

  function requestLocation() {
    setAlert(null);
    setLocating(true);
    setGpsStatus("กำลังเข้าถึงพิกัด GPS ของอุปกรณ์... (รอสัญญาณนิ่งสูงสุด 15 วินาที)");

    if (!navigator.geolocation) {
      setAlert({ type: "error", message: "เบราว์เซอร์ของคุณไม่รองรับการดึงค่าตำแหน่ง Geolocation" });
      setLocating(false);
      return;
    }

    let best: { lat: number; lng: number; accuracy: number } | null = null;
    let settled = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (settled) return;
        const { latitude, longitude, accuracy } = position.coords;
        if (!best || accuracy < best.accuracy) {
          best = { lat: latitude, lng: longitude, accuracy };
          setGpsStatus(`กำลังปรับสัญญาณ... ความแม่นยำล่าสุด ±${Math.round(accuracy)} ม.`);
        }
        if (accuracy <= GOOD_ENOUGH_ACCURACY) {
          settled = true;
          navigator.geolocation.clearWatch(watchId);
          finishLocating(best.lat, best.lng, best.accuracy);
        }
      },
      (error) => {
        if (settled) return;
        // A transient error (e.g. one bad fix) shouldn't kill the whole retry window if we
        // already have a reading, or if there's still time left — only bail out immediately
        // on a hard permission denial, which retrying can never fix.
        if (error.code === error.PERMISSION_DENIED) {
          settled = true;
          navigator.geolocation.clearWatch(watchId);
          setLocating(false);
          setGpsStatus("สถานะ GPS: รอตรวจพิกัด");
          setAlert({ type: "error", message: "ต้องอนุญาตสิทธิ์การเข้าถึงตำแหน่ง จึงจะสามารถดำเนินการเช็คชื่อเข้าแถวได้" });
        }
      },
      { enableHighAccuracy: true, timeout: MAX_WAIT_MS, maximumAge: 0 },
    );

    setTimeout(() => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      if (best) {
        finishLocating(best.lat, best.lng, best.accuracy);
      } else {
        setLocating(false);
        setGpsStatus("สถานะ GPS: รอตรวจพิกัด");
        setAlert({ type: "error", message: "ไม่สามารถระบุพิกัดที่ตั้งของท่านได้ กรุณาตรวจสอบสัญญาณ GPS แล้วลองใหม่อีกครั้ง" });
      }
    }, MAX_WAIT_MS);
  }

  async function confirmCheckin() {
    setSubmitting(true);
    setAlert(null);
    try {
      const { lat, lng, accuracy } = coordsRef.current;
      const result = await submitCheckin(lat, lng, accuracy);
      if (result.ok) {
        if (timerRef.current) clearInterval(timerRef.current);
        setCompleteMessage(result.message);
        if ("status" in result && typeof result.status === "string") setDoneStatus(result.status);
        setStep("done");
      } else {
        setAlert({ type: "error", message: result.message });
      }
    } catch (err) {
      setAlert({ type: "error", message: `เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : "unknown"}` });
    } finally {
      setSubmitting(false);
    }
  }

  function submitScanFailReport() {
    setAlert(null);
    startScanFailTransition(async () => {
      try {
        const coords = await getBestEffortGps();
        const result = coords
          ? await reportScanFail(coords.lat, coords.lng, coords.accuracy)
          : await reportScanFail(null, null, null);
        if (result.ok) {
          setScanFailReported(result.reportedAt);
          setScanFailGeoState({
            distanceMeters: result.distanceMeters,
            outsideRadius: result.outsideRadius,
            radius: result.radius,
          });
        }
        setAlert({
          type: result.ok ? "success" : "error",
          message: result.message,
        });
      } catch (err) {
        setAlert({
          type: "error",
          message: `เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    });
  }

  function cancelScanFailReport() {
    setAlert(null);
    startScanFailTransition(async () => {
      try {
        const result = await cancelMyScanFail();
        if (result.ok) {
          setScanFailReported(null);
          setScanFailGeoState(null);
        }
        setAlert({ type: result.ok ? "success" : "error", message: result.message });
      } catch (err) {
        setAlert({
          type: "error",
          message: `เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    });
  }

  const alertMeta =
    alert?.type === "error"
      ? { icon: "✕", ring: "bg-rose-500/15 border-rose-500/30 text-rose-300", title: "ไม่สำเร็จ" }
      : alert?.type === "success"
        ? { icon: "✓", ring: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300", title: "สำเร็จ" }
        : { icon: "!", ring: "bg-amber-500/15 border-amber-500/30 text-amber-300", title: "แจ้งเตือน" };

  return (
    <main className="flex-grow flex items-center justify-center">
      <div className="w-full max-w-full mx-auto space-y-6">
        <div className="glass-panel rounded-2xl p-6 flex items-center gap-4">
          {linePictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={linePictureUrl}
              alt={fullName}
              className="w-14 h-14 rounded-full object-cover border border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {fullName.slice(0, 1)}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-white">
              {fullName}
              {nickname ? <span className="block text-slate-300 font-semibold">({nickname})</span> : null}
            </h2>
            <p className="text-slate-400 text-sm">
              รหัสนักเรียน: {studentId} • ห้องเรียน: {roomName}
            </p>
          </div>
        </div>

        {holidayName && (
          <div className="glass-panel rounded-2xl p-5 border-l-4 border-l-indigo-500 flex items-center gap-4">
            <span className="text-3xl shrink-0">🏖️</span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white break-words">วันนี้เป็นวันหยุด · {holidayName}</h2>
              <p className="text-slate-400 text-sm mt-0.5">{todayLabel}</p>
              <p className="text-slate-400 text-sm">ไม่มีการเปิดรอบเช็คชื่อเข้าแถวในวันนี้</p>
            </div>
          </div>
        )}

        {alert && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
            onClick={() => setAlert(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 text-center animate-[popIn_0.2s_cubic-bezier(0.16,1,0.3,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`mx-auto mb-4 w-14 h-14 rounded-full border flex items-center justify-center text-2xl font-bold ${alertMeta.ring}`}>
                {alertMeta.icon}
              </div>
              <h4 className="text-white font-bold text-lg mb-1.5">{alertMeta.title}</h4>
              <p className="text-slate-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: alert.message }} />
              <button
                type="button"
                onClick={() => setAlert(null)}
                className="mt-5 w-full rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 transition-colors"
              >
                ตกลง
              </button>
            </div>
          </div>
        )}

        {step === "locate" && (
          <div className="glass-panel rounded-2xl p-8 space-y-6 text-center">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">ตรวจสอบตำแหน่งของคุณ</h3>
              <p className="text-slate-400 text-sm">กดปุ่มด้านล่างเพื่อดึงพิกัด GPS เพื่อยืนยันว่าคุณอยู่บริเวณจุดเช็คชื่อเข้าแถว</p>
              <div className="inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mt-1">
                <span>📍 จุดเข้าแถววันนี้: {locationName}</span>
                <span className="text-cyan-400/80">(รัศมี {radius} ม.)</span>
              </div>
            </div>
            <div className="py-4">
              <div className="text-sm text-slate-500 mb-4 whitespace-pre-line">{gpsStatus}</div>
              <button
                onClick={requestLocation}
                disabled={locating}
                className="w-full bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-600 hover:to-indigo-600 disabled:opacity-50 text-white font-bold py-5 px-6 rounded-2xl shadow-xl hover:shadow-cyan-500/10 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 text-lg"
              >
                {locating ? "กำลังตรวจพิกัด..." : "เช็คอินระบุตำแหน่งพิกัด"}
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="glass-panel rounded-2xl p-8 space-y-6 text-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                ✓ พิกัดเข้าแถวถูกต้อง
              </div>
              <h3 className="text-xl font-bold text-white mt-2">ขั้นตอนที่ 2: บันทึกยืนยันเช็คชื่อ</h3>
              <p className="text-slate-400 text-sm">ตรวจสอบพิกัดตำแหน่งเรียบร้อยแล้ว กดปุ่มยืนยันด้านล่างเพื่อลงชื่อเช็คอินเข้าแถวทันที</p>
            </div>
            {distance !== null && (
              <div className="flex items-center justify-center gap-2 text-cyan-300 text-sm bg-cyan-500/5 py-2 px-4 rounded-xl border border-cyan-500/15 w-fit mx-auto">
                <span className="text-center">
                  📍 คุณอยู่ห่างจากจุดเช็คอิน <strong>{distance}</strong> เมตร
                  <br />
                  (รัศมีที่กำหนด {radius} เมตร)
                </span>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-amber-400 text-sm bg-amber-500/5 py-2 px-4 rounded-xl border border-amber-500/10 w-fit mx-auto">
              <span>
                ตำแหน่งพิกัดจะหมดอายุภายใน: <strong>{countdown} วินาที</strong>
              </span>
            </div>
            <button
              onClick={confirmCheckin}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white font-bold py-5 px-6 rounded-2xl shadow-xl active:scale-[0.98] transition-all duration-300 text-lg"
            >
              {submitting ? "กำลังทำการเช็คอิน..." : "ยืนยันการลงชื่อเข้าแถว"}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="glass-panel rounded-2xl p-8 space-y-6 text-center">
            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-full flex items-center justify-center mx-auto scale-110 text-3xl">
              ✓
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-white">เช็คชื่อสำเร็จ!</h3>
              <StatusBadge status={doneStatus} />
              <p className="text-slate-300 text-base" dangerouslySetInnerHTML={{ __html: completeMessage }} />
            </div>
          </div>
        )}

        {scanFailReported ? (
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-emerald-500/30 bg-emerald-500/5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                ✓
              </div>
              <div className="min-w-0">
                <h4 className="text-white font-bold">แจ้งสแกนหน้าไม่ติดแล้ว</h4>
                <p className="text-emerald-300/90 text-sm">
                  เมื่อเวลา {scanFailReported} น. · {scanFailAcknowledgedAt ? "ครูยืนยันแล้ว" : "ครูจะตรวจสอบให้"}
                </p>
              </div>
            </div>
            {scanFailAcknowledgedAt && (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 flex items-center gap-3">
                <span className="text-2xl shrink-0">✅</span>
                <div className="min-w-0">
                  <p className="text-emerald-200 font-bold text-sm">ครูรับทราบแล้ว</p>
                  <p className="text-emerald-300/80 text-xs">ครูยืนยันว่าคุณอยู่ในบริเวณโรงเรียนจริง · เวลา {scanFailAcknowledgedAt} น.</p>
                </div>
              </div>
            )}
            {scanFailGeoState &&
              (scanFailGeoState.distanceMeters === null ? (
                <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
                  📍 ไม่มีพิกัด (ดึง GPS ไม่ได้ตอนแจ้ง)
                </div>
              ) : scanFailGeoState.outsideRadius ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  ⚠️ แจ้งจาก<strong>นอกรัศมี</strong> ~{scanFailGeoState.distanceMeters} ม.
                  {" "}(เกินกำหนด {scanFailGeoState.radius} ม.)
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  📍 แจ้งจาก<strong>ในรัศมี</strong> (~{scanFailGeoState.distanceMeters} ม. · กำหนด {scanFailGeoState.radius} ม.)
                </div>
              ))}
            {!scanFailAcknowledgedAt && (
              <button
                type="button"
                onClick={cancelScanFailReport}
                disabled={scanFailPending}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 font-semibold py-3 px-5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {scanFailPending ? "กำลังยกเลิก..." : "ยกเลิกการแจ้ง"}
              </button>
            )}
          </div>
        ) : (
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-800/80 bg-slate-950/30 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-300 shrink-0">
                !
              </div>
              <div className="min-w-0">
                <h4 className="text-white font-bold">สแกนหน้าไม่ติดใช่ไหม?</h4>
                <p className="text-slate-400 text-sm">
                  กดแจ้งได้ทันที ระบบจะพยายามดึงพิกัดแบบดีที่สุดเท่าที่ทำได้ แต่ GPS ไม่บังคับ
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={submitScanFailReport}
              disabled={scanFailPending}
              className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 text-amber-200 font-bold py-4 px-5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {scanFailPending ? "กำลังส่งรายงาน..." : "สแกนหน้าไม่ติด? แจ้งที่นี่"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
