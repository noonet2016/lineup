"use client";

type AssemblyTimeFieldsProps = {
  defaultValues: {
    checkStart: string;
    lateAfter: string;
    checkEnd: string;
  };
};

export default function AssemblyTimeFields({ defaultValues }: AssemblyTimeFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <label>
        <span className="block text-xs font-semibold text-slate-400 mb-2">เริ่มเช็คเวลา (Start)</span>
        <input type="time" name="check_start" defaultValue={defaultValues.checkStart.slice(0, 5)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
      </label>
      <label>
        <span className="block text-xs font-semibold text-slate-400 mb-2">บันทึกสาย (Late)</span>
        <input type="time" name="late_after" defaultValue={defaultValues.lateAfter.slice(0, 5)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
      </label>
      <label>
        <span className="block text-xs font-semibold text-slate-400 mb-2">สิ้นสุดการเข้าแถวเวลา (End)</span>
        <input type="time" name="check_end" defaultValue={defaultValues.checkEnd.slice(0, 5)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
      </label>
    </div>
  );
}
