"use server";

import { loadDashboard, type DashboardData, type DashboardFilter } from "@/lib/dashboard";

/** Mirrors legacy teacher/dashboard_data.php: same data as the page's initial load, for 30s client polling. */
export async function fetchDashboardSnapshot(classroomId: number, filter: DashboardFilter): Promise<DashboardData> {
  return loadDashboard(classroomId, filter);
}
