import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMyLeaveRequests } from "@/lib/actions/leave";
import { StudentShell } from "@/app/_components/LegacyChrome";
import PollRefresh from "@/app/_components/PollRefresh";
import LeaveClient from "./LeaveClient";
import { prisma } from "@/lib/prisma";
import { studentAvatarUrl } from "@/lib/studentPhoto";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const session = await getSession();
  if (!session || session.role !== "student") redirect("/login");

  const me = await prisma.student.findUnique({
    where: { studentId: session.id },
    select: { studentId: true, fullName: true, nickname: true, numberInClass: true, linePictureUrl: true },
  });
  if (!me) redirect("/login");

  const rows = await getMyLeaveRequests();
  const requests = rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    startDate: r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : null,
    endDate: r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : null,
    status: r.status,
    reviewNote: r.reviewNote,
    reviewedAt: r.reviewedAt ? String(r.reviewedAt) : null,
    createdAt: String(r.createdAt),
  }));

  return (
    <StudentShell active="leave">
      <PollRefresh />
      <LeaveClient
        requests={requests}
        student={{
          fullName: me.fullName,
          nickname: me.nickname,
          numberInClass: me.numberInClass,
          photoUrl: studentAvatarUrl(me.studentId, me.linePictureUrl),
        }}
      />
    </StudentShell>
  );
}
