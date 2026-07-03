"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ThaiDatePickerProps = {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  placeholder?: string;
  id?: string;
};

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const THAI_WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISO(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parseISO(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, monthIndex: month - 1, day };
}

function getTodayBangkokISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

function formatThaiDate(value: string) {
  const parsed = parseISO(value);
  if (!parsed) return "";
  return `${parsed.day} ${THAI_MONTHS[parsed.monthIndex]} ${parsed.year + 543}`;
}

export default function ThaiDatePicker({ value, onChange, min, placeholder = "เลือกวันที่", id }: ThaiDatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseISO(value);
  const minValue = min ?? "";
  const todayISO = useMemo(() => getTodayBangkokISO(), []);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const base = selected ?? parseISO(minValue) ?? parseISO(todayISO);
    return { year: base?.year ?? new Date().getFullYear(), monthIndex: base?.monthIndex ?? new Date().getMonth() };
  });

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (selected) setViewDate({ year: selected.year, monthIndex: selected.monthIndex });
  }, [selected?.year, selected?.monthIndex]);

  const firstWeekday = new Date(viewDate.year, viewDate.monthIndex, 1).getDay();
  const daysInMonth = new Date(viewDate.year, viewDate.monthIndex + 1, 0).getDate();
  const viewLabel = `${THAI_MONTHS[viewDate.monthIndex]} ${viewDate.year + 543}`;
  const displayValue = formatThaiDate(value);

  function moveMonth(delta: number) {
    setViewDate((current) => {
      const next = new Date(current.year, current.monthIndex + delta, 1);
      return { year: next.getFullYear(), monthIndex: next.getMonth() };
    });
  }

  function selectDay(day: number) {
    const nextValue = toISO(viewDate.year, viewDate.monthIndex, day);
    if (minValue && nextValue < minValue) return;
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-left text-sm text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      >
        <span className={displayValue ? "text-slate-100" : "text-slate-500"}>{displayValue || placeholder}</span>
        <span aria-hidden="true" className="text-slate-500">
          ◷
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-800 bg-slate-900/95 p-3 shadow-xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="grid size-8 place-items-center rounded-lg border border-slate-800 bg-slate-950/60 text-lg text-slate-300 hover:border-indigo-500/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              aria-label="เดือนก่อนหน้า"
            >
              ‹
            </button>
            <div className="text-sm font-semibold text-slate-100">{viewLabel}</div>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="grid size-8 place-items-center rounded-lg border border-slate-800 bg-slate-950/60 text-lg text-slate-300 hover:border-indigo-500/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              aria-label="เดือนถัดไป"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
            {THAI_WEEKDAYS.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, index) => (
              <div key={`blank-${index}`} className="size-9" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const iso = toISO(viewDate.year, viewDate.monthIndex, day);
              const isSelected = value === iso;
              const isToday = todayISO === iso;
              const disabled = Boolean(minValue && iso < minValue);

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => selectDay(day)}
                  disabled={disabled}
                  className={
                    "grid size-9 place-items-center rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 " +
                    (isSelected
                      ? "bg-indigo-500 text-white"
                      : disabled
                        ? "cursor-not-allowed text-slate-700"
                        : isToday
                          ? "text-indigo-300 ring-1 ring-indigo-500/40 hover:bg-slate-800"
                          : "text-slate-200 hover:bg-slate-800")
                  }
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
