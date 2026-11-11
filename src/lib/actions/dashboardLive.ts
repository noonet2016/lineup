"use server";

import { requireClassroomManager } from "@/lib/teacher";
import { loadDashboard, type DashboardData, type DashboardFilter } from "@/lib/dashboard";

/** Mirrors legacy teacher/dashboard_data.php: same data as the page's initial load, for 30s client polling. */
export async function fetchDashboardSnapshot(classroomId: number, filter: DashboardFilter): Promise<DashboardData> {
  // Ownership gate — the room's advisor or the admin (admin mode) may poll its live roster/stats.
  await requireClassroomManager(classroomId);
  return loadDashboard(classroomId, filter);
}
