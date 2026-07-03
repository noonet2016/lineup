"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { logout } from "@/lib/actions/auth";

type TeacherMobileNavItem = {
  key: string;
  label: string;
  href: string;
  path: string;
};

type TeacherMobileNavProps = {
  items: TeacherMobileNavItem[];
  active: string;
  fullName?: string;
  roomName?: string;
};

function Icon({ path, className = "w-5 h-5", strokeWidth = 1.8 }: { path: string; className?: string; strokeWidth?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

export function TeacherMobileNav({ items, active, fullName, roomName }: TeacherMobileNavProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center -ml-2 rounded-xl text-slate-200 hover:text-white hover:bg-slate-900/70 active:scale-95 transition"
        aria-label="เปิดเมนู"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Icon path="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" className="w-7 h-7" strokeWidth={2} />
      </button>

      {mounted &&
        createPortal(
          <>
            {open && <button type="button" className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" aria-label="ปิดเมนู" onClick={() => setOpen(false)} />}

            <div
              className={`fixed top-0 left-0 z-[110] flex h-full w-72 max-w-[85vw] flex-col bg-slate-950 border-r border-slate-900 p-4 shadow-2xl shadow-black/40 transition-transform duration-200 ${
                open ? "translate-x-0" : "-translate-x-full"
              }`}
              aria-hidden={!open}
            >
        <div className="flex items-center justify-between h-12 border-b border-slate-900 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
            <span className="font-bold text-white tracking-wider text-sm">TEACHER PORTAL</span>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center -mr-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900/70 active:scale-95 transition"
            aria-label="ปิดเมนู"
            onClick={() => setOpen(false)}
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1.5">
          {items.map((item) => {
            const on = active === item.key;
            return (
              <a
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  on ? "bg-indigo-500/15 border-indigo-500/30 text-white" : "border-transparent text-slate-400 hover:text-white hover:bg-slate-900/60"
                }`}
              >
                <Icon path={item.path} className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="border-t border-slate-900 pt-4">
          {fullName && (
            <p className="text-xs text-slate-400 mb-3 px-1 truncate">
              สวัสดี, {fullName}
              {roomName ? ` (ม.${roomName})` : ""}
            </p>
          )}
          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 transition-colors">
              ออกจากระบบ
            </button>
          </form>
            </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
