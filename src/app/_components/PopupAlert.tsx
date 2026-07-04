"use client";

import { useCallback, useState } from "react";

export type PopupType = "success" | "error" | "warning";
export type PopupAlert = { type: PopupType; message: string } | null;

const META: Record<PopupType, { icon: string; ring: string; title: string }> = {
  error: { icon: "✕", ring: "bg-rose-500/15 border-rose-500/30 text-rose-300", title: "ไม่สำเร็จ" },
  success: { icon: "✓", ring: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300", title: "สำเร็จ" },
  warning: { icon: "!", ring: "bg-amber-500/15 border-amber-500/30 text-amber-300", title: "แจ้งเตือน" },
};

/** State + helpers for showing a single modern popup alert. */
export function usePopupAlert() {
  const [alert, setAlert] = useState<PopupAlert>(null);
  const show = useCallback((type: PopupType, message: string) => setAlert({ type, message }), []);
  const showResult = useCallback(
    (result: { ok: boolean; message: string }) => setAlert({ type: result.ok ? "success" : "error", message: result.message }),
    [],
  );
  const close = useCallback(() => setAlert(null), []);
  return { alert, setAlert, show, showResult, close };
}

/** Modern centered popup alert (replaces inline toast/banner feedback). Renders nothing when alert is null. */
export function PopupAlertModal({
  alert,
  onClose,
  buttonLabel = "ตกลง",
}: {
  alert: PopupAlert;
  onClose: () => void;
  buttonLabel?: string;
}) {
  if (!alert) return null;
  const meta = META[alert.type];
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 text-center animate-[popIn_0.2s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`mx-auto mb-4 w-14 h-14 rounded-full border flex items-center justify-center text-2xl font-bold ${meta.ring}`}>
          {meta.icon}
        </div>
        <h4 className="text-white font-bold text-lg mb-1.5">{meta.title}</h4>
        <p className="text-slate-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: alert.message }} />
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 transition-colors"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
