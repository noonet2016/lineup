"use client";

import { useEffect, useState } from "react";

type Phase = "loading" | "error" | "not_linked";

export default function LiffEntryPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("กำลังเชื่อมต่อ LINE...");
  const [idToken, setIdToken] = useState<string | null>(null);

  // self-bind form state
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);

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

        const token = liff.getIDToken();
        if (!token) {
          if (!cancelled) { setPhase("error"); setMessage("ไม่ได้รับ ID token — ต้องเปิดสิทธิ์ openid ของ LIFF"); }
          return;
        }
        if (!cancelled) setIdToken(token);

        const res = await fetch("/api/auth/liff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token }),
        });
        const data = (await res.json()) as { ok: boolean; redirect?: string; error?: string };

        if (data.ok && data.redirect) {
          window.location.replace(data.redirect);
          return;
        }
        if (data.error === "not_linked") {
          if (!cancelled) setPhase("not_linked"); // show self-bind form
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

  async function handleBind(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken || binding) return;
    setBindError(null);
    if (!studentId.trim() || !password) {
      setBindError("กรอกรหัสนักเรียนและรหัสผ่านให้ครบ");
      return;
    }
    setBinding(true);
    try {
      const res = await fetch("/api/auth/liff/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, studentId: studentId.trim(), password }),
      });
      const data = (await res.json()) as { ok: boolean; redirect?: string; error?: string };
      if (data.ok && data.redirect) {
        window.location.replace(data.redirect);
        return;
      }
      setBindError(data.error ?? "ผูกบัญชีไม่สำเร็จ");
    } catch (e) {
      setBindError(e instanceof Error ? e.message : String(e));
    } finally {
      setBinding(false);
    }
  }

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
          <form onSubmit={handleBind} className="space-y-4 text-left">
            <div className="text-center space-y-1">
              <h1 className="text-lg font-bold text-white">ผูกบัญชีนักเรียนกับ LINE</h1>
              <p className="text-slate-400 text-xs">
                เปิดใช้ครั้งแรก — กรอกรหัสนักเรียนและรหัสผ่านเพื่อผูกกับ LINE ของคุณ ครั้งต่อไปเข้าได้ทันที
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">รหัสนักเรียน</label>
              <input
                inputMode="numeric"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="เลขประจำตัวนักเรียน"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="รหัสผ่าน"
              />
            </div>
            {bindError && (
              <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{bindError}</p>
            )}
            <button
              type="submit"
              disabled={binding}
              className="w-full bg-[#06C755] hover:bg-[#05b34c] disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition-all"
            >
              {binding ? "กำลังผูกบัญชี..." : "ผูกบัญชีและเข้าใช้งาน"}
            </button>
          </form>
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
