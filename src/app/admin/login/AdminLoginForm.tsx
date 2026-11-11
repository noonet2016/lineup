"use client";

import { useActionState, useEffect } from "react";
import { loginAdmin, type LoginResult } from "@/lib/actions/auth";
import PasswordInput from "@/app/_components/PasswordInput";

const initialState: LoginResult = { ok: false, error: "" };

export default function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(loginAdmin, initialState);

  useEffect(() => {
    if (state.ok) {
      // The session cookie is set by the server action. A hard navigation ensures
      // the subsequent request includes it instead of racing a soft RSC navigation.
      window.location.assign("/admin");
    }
  }, [state.ok]);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">ชื่อผู้ใช้ (Username)</label>
        <input
          id="username"
          name="username"
          required
          autoFocus
          autoComplete="username"
          placeholder="ระบุชื่อผู้ใช้ผู้ดูแลระบบ"
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-lg"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">รหัสผ่าน (Password)</label>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-lg"
        />
      </div>
      {!state.ok && state.error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
          {state.error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      >
        {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบผู้ดูแลระบบ"}
      </button>
    </form>
  );
}
