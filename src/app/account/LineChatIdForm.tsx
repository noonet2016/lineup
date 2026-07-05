"use client";

import { useState, useTransition } from "react";
import { updateMyLineChatId } from "@/lib/actions/studentAccount";
import { lineChatUrl } from "@/lib/lineChatId";

export default function LineChatIdForm({ initialLineChatId }: { initialLineChatId: string | null }) {
  const [value, setValue] = useState(initialLineChatId ?? "");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateMyLineChatId(value);
      setMessage({ type: result.ok ? "success" : "error", text: result.message });
    });
  }

  return (
    <div className="pt-3 border-t border-slate-800 space-y-2">
      <label htmlFor="line-chat-id" className="block text-sm font-semibold text-white">
        LINE ID ของฉัน (ให้ครูทักได้)
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id="line-chat-id"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="เช่น jao.nakubb"
          className="min-w-0 flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        />
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="bg-[#06C755] hover:bg-[#05b34c] disabled:opacity-60 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all"
        >
          บันทึก
        </button>
      </div>
      {initialLineChatId && (
        <a
          href={lineChatUrl(initialLineChatId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
        >
          💬 เปิดแชท LINE: {initialLineChatId}
        </a>
      )}
      <p className="text-[11px] text-slate-500">ใช้ public LINE ID เท่านั้น ไม่ใช่ LINE user ID ที่ขึ้นต้นด้วย U</p>
      {message && (
        <p className={`text-xs ${message.type === "success" ? "text-emerald-400" : "text-rose-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
