"use client";

import { useActionState, useEffect } from "react";
import { loginStudent, loginTeacher, type LoginResult } from "@/lib/actions/auth";

const initialState: LoginResult = { ok: false, error: "" };

export default function LoginForms({ initialRole = "student" }: { initialRole?: "student" | "teacher" }) {
  const action = initialRole === "student" ? loginStudent : loginTeacher;
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) {
      // Hard navigation (not router.push): the session cookie is set inside the
      // server action, and a soft nav's RSC fetch can race the cookie commit,
      // landing back on /login even though auth succeeded. A full GET guarantees
      // the freshly-set cookie is sent.
      window.location.assign("/account");
    }
  }, [state.ok]);

  const isTeacher = initialRole === "teacher";
  const submitButtonClassName = isTeacher
    ? "w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
    : "w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-500/50";

  return (
    <>
      <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={`w-5 h-5 ${isTeacher ? "text-indigo-400" : "text-cyan-400"}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d={isTeacher ? "M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" : "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"} />
        </svg>
        {isTeacher ? "ลงชื่อเข้าใช้ (ครูที่ปรึกษา)" : "ลงชื่อเข้าใช้ (นักเรียน)"}
      </h2>

      <form action={formAction} className="space-y-5">
        {!isTeacher ? (
          <div>
            <label htmlFor="studentId" className="block text-sm font-medium text-slate-300 mb-2">รหัสนักเรียน</label>
            <input
              id="studentId"
              name="studentId"
              required
              autoFocus
              placeholder="กรอกรหัสนักเรียน 5 หลัก"
              autoComplete="username"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all text-lg"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">ชื่อผู้ใช้ (Username)</label>
            <input
              id="username"
              name="username"
              required
              placeholder="ระบุชื่อผู้ใช้สำหรับครู"
              autoComplete="username"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-lg"
            />
          </div>
        )}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">{isTeacher ? "รหัสผ่าน (Password)" : "รหัสผ่าน"}</label>
          <input
            id="password"
            type="password"
            name="password"
            required
            placeholder="••••••••"
            autoComplete="current-password"
            className={`w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all text-lg ${isTeacher ? "focus:ring-indigo-500/50 focus:border-indigo-500" : "focus:ring-cyan-500/50 focus:border-cyan-500"}`}
          />
        </div>
        {!state.ok && state.error && <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{state.error}</div>}
        <button
          type="submit"
          disabled={pending}
          className={submitButtonClassName}
        >
          {pending ? "กำลังเข้าสู่ระบบ..." : isTeacher ? "เข้าสู่ระบบครูที่ปรึกษา" : "เข้าสู่ระบบ"}
        </button>
      </form>
    </>
  );
}
