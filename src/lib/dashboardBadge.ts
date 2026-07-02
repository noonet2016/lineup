// Pure, no server/Prisma imports — safe to import from client components (unlike dashboard.ts).
export type DashboardStatus = "present" | "late" | "absent" | "pending" | "flagged" | "excused";

export function dashBadge(status: DashboardStatus): { text: string; className: string } {
  switch (status) {
    case "present":
      return { text: "มาปกติ", className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" };
    case "late":
      return { text: "สาย", className: "bg-amber-500/10 border-amber-500/20 text-amber-400" };
    case "absent":
      return { text: "ขาด", className: "bg-rose-500/10 border-rose-500/20 text-rose-400" };
    case "flagged":
      return { text: "นอกรัศมี", className: "bg-orange-500/10 border-orange-500/20 text-orange-400" };
    case "pending":
      return { text: "รอตรวจ", className: "bg-slate-500/10 border-slate-500/20 text-slate-400" };
    case "excused":
      return { text: "ลา/กิจกรรม", className: "bg-sky-500/10 border-sky-500/20 text-sky-400" };
    default:
      return { text: status, className: "bg-slate-500/10 border-slate-500/20 text-slate-400" };
  }
}
