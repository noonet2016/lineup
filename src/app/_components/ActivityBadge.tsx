export type ActivityColor = "fuchsia" | "amber" | "lime" | "sky" | "violet" | "rose" | "slate";

const COLOR_META: Record<ActivityColor, string> = {
  fuchsia: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300",
  amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  lime: "bg-lime-500/10 border-lime-500/30 text-lime-300",
  sky: "bg-sky-500/10 border-sky-500/30 text-sky-300",
  violet: "bg-violet-500/10 border-violet-500/30 text-violet-300",
  rose: "bg-rose-500/10 border-rose-500/30 text-rose-300",
  slate: "bg-slate-500/10 border-slate-500/30 text-slate-300",
};

function normalizeColor(color: string): ActivityColor {
  return color in COLOR_META ? (color as ActivityColor) : "slate";
}

export default function ActivityBadge({ name, color }: { name: string; color: string }) {
  const token = normalizeColor(color);
  return (
    <span className={`inline-flex items-center border rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${COLOR_META[token]}`}>
      {name}
    </span>
  );
}

export function activityColorClass(color: string): string {
  return COLOR_META[normalizeColor(color)];
}
