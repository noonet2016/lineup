"use client";

import { useEffect, useState } from "react";

type Phase = "loading" | "error" | "not_linked";

export default function LiffEntryPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("กำลังเชื่อมต่อ LINE...");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
          if (!cancelled) { setPhase("error"); setMessage("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID"); }
          return;
        }
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login(); // redirects within LINE, then returns to this page
          return;
        }

        const idToken = liff.getIDToken();
        if (!idToken) {
          if (!cancelled) { setPhase("error"); setMessage("ไม่ได้รับ ID token — ต้องเปิดสิทธิ์ openid ของ LIFF"); }
          return;
        }

        const res = await fetch("/api/auth/liff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const data = (await res.json()) as { ok: boolean; redirect?: string; error?: string };

        if (data.ok && data.redirect) {
          window.location.replace(data.redirect);
          return;
        }
        if (data.error === "not_linked") {
          if (!cancelled) {
            setPhase("not_linked");
            setMessage("ไม่พบบัญชีนักเรียนที่ผูกกับ LINE นี้");
          }
          return;
        }
        if (!cancelled) { setPhase("error"); setMessage("เข้าสู่ระบบไม่สำเร็จ: " + (data.error ?? "unknown")); }
      } catch (e) {
        if (!cancelled) {
          setPhase("error");
          setMessage("LIFF error: " + (e instanceof Error ? e.message : String(e)));
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-950 safe-px py-8">
      <div className="glass-panel rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
        <div className="text-4xl">🟢</div>
        {phase === "loading" && (
          <>
            <div className="mx-auto w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
            <p className="text-slate-300 text-sm">{message}</p>
          </>
        )}
        {phase === "not_linked" && (
          <div className="space-y-3">
            <h1 className="text-lg font-bold text-white">{message}</h1>
            <p className="text-slate-400 text-sm">
              ให้คุณครูผูกบัญชี LINE ให้ที่หน้า “สถานะผูก LINE” หรือเข้าเว็บเพื่อผูกบัญชีด้วยตนเองก่อน แล้วเปิดใหม่อีกครั้ง
            </p>
          </div>
        )}
        {phase === "error" && (
          <div className="space-y-3">
            <h1 className="text-lg font-bold text-rose-400">เกิดข้อผิดพลาด</h1>
            <p className="text-slate-400 text-sm break-words">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
