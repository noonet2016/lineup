"use client";

import { useEffect, useRef, useState } from "react";
import { locateCheckin, submitCheckin } from "@/lib/checkin";

const STATUS_LABEL: Record<string, string> = {
  present: "มาปกติ",
  late: "สาย",
  pending: "รอตรวจสอบ (สัญญาณพิกัดขัดข้อง)",
  flagged: "รอตรวจสอบ (อยู่นอกรัศมีที่ตั้งไว้)",
};

type Props = {
  fullName: string;
  nickname: string | null;
  studentId: string;
  roomName: string;
  locationName: string;
  radius: number;
  alreadyCheckedIn: boolean;
  existingStatus: string | null;
  existingCheckTime: string | null;
};

type Step = "locate" | "confirm" | "done";
type Alert = { type: "error" | "success" | "warning"; message: string } | null;

export default function CheckinClient({
  fullName,
  nickname,
  studentId,
  roomName,
  locationName,
  radius,
  alreadyCheckedIn,
  existingStatus,
  existingCheckTime,
}: Props) {
  const [step, setStep] = useState<Step>(alreadyCheckedIn ? "done" : "locate");
  const [gpsStatus, setGpsStatus] = useState("สถานะ GPS: รอตรวจพิกัด");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<Alert>(null);
  const [countdown, setCountdown] = useState(120);
  const [completeMessage, setCompleteMessage] = useState<string>(
    alreadyCheckedIn && existingCheckTime
      ? `คุณได้ทำการเช็คชื่อเข้าแถวในวันนี้เรียบร้อยแล้ว<br>สถานะ: <strong>${STATUS_LABEL[existingStatus ?? ""] ?? existingStatus}</strong><br><span class="text-sm text-emerald-400 font-semibold mt-2 block">เมื่อ: ${new Date(existingCheckTime).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} น.</span>`
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

  function requestLocation() {
    setAlert(null);
    setLocating(true);
    setGpsStatus("กำลังเข้าถึงพิกัด GPS ของอุปกรณ์...");

    if (!navigator.geolocation) {
      setAlert({ type: "error", message: "เบราว์เซอร์ของคุณไม่รองรับการดึงค่าตำแหน่ง Geolocation" });
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        coordsRef.current = { lat: latitude, lng: longitude, accuracy };
        setGpsStatus(`พิกัดปัจจุบัน: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (คลาดเคลื่อน ±${Math.round(accuracy)} ม.)`);

        try {
          const result = await locateCheckin(latitude, longitude, accuracy);
          if ("inRadius" in result && result.inRadius) {
            setStep("confirm");
            startCountdown();
          } else if (result.gpsWeak) {
            setStep("confirm");
            startCountdown();
            setAlert({ type: "warning", message: `สัญญาณตำแหน่งค่อนข้างต่ำ: ${result.message}` });
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
      },
      (error) => {
        setLocating(false);
        setGpsStatus("สถานะ GPS: รอตรวจพิกัด");
        let msg = "เกิดข้อผิดพลาดในการดึงค่าตำแหน่งของคุณ";
        if (error.code === error.PERMISSION_DENIED) msg = "ต้องอนุญาตสิทธิ์การเข้าถึงตำแหน่ง จึงจะสามารถดำเนินการเช็คชื่อเข้าแถวได้";
        else if (error.code === error.POSITION_UNAVAILABLE) msg = "ไม่สามารถระบุพิกัดที่ตั้งของท่านได้ในขณะนี้";
        else if (error.code === error.TIMEOUT) msg = "การค้นหาพิกัด GPS หมดเวลาก่อนการตอบสนอง";
        setAlert({ type: "error", message: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
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

  const alertClass =
    alert?.type === "error"
      ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
      : alert?.type === "success"
        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        : "bg-amber-500/10 border-amber-500/20 text-amber-400";

  return (
    <main className="flex-grow flex items-center justify-center">
      <div className="w-full max-w-xl space-y-6">
        <div className="glass-panel rounded-2xl p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 flex items-center justify-center text-white text-xl font-bold">
            {fullName.slice(0, 1)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {fullName}
              {nickname ? ` (${nickname})` : ""}
            </h2>
            <p className="text-slate-400 text-sm">
              รหัสนักเรียน: {studentId} • ห้องเรียน: {roomName}
            </p>
          </div>
        </div>

        {alert && (
          <div className={`p-4 rounded-xl text-sm border ${alertClass}`} dangerouslySetInnerHTML={{ __html: alert.message }} />
        )}

        {step === "locate" && (
          <div className="glass-panel rounded-2xl p-8 space-y-6 text-center">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">ขั้นตอนที่ 1: ตรวจสอบตำแหน่งของคุณ</h3>
              <p className="text-slate-400 text-sm">กดปุ่มด้านล่างเพื่อดึงพิกัด GPS เพื่อยืนยันว่าคุณอยู่บริเวณจุดเช็คชื่อเข้าแถว</p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold mt-1">
                📍 จุดเข้าแถววันนี้: {locationName} (รัศมี {radius} ม.)
              </div>
            </div>
            <div className="py-4">
              <div className="text-sm text-slate-500 mb-4">{gpsStatus}</div>
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
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">เช็คชื่อสำเร็จ!</h3>
              <p className="text-slate-300 text-base" dangerouslySetInnerHTML={{ __html: completeMessage }} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
