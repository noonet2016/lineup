import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { readStudentPhoto } from "@/lib/studentPhoto";

/**
 * Student school photo — teachers only: the advisor of the student's classroom, or the admin.
 * Photos are PII and stored outside git/public (see src/lib/studentPhoto.ts).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;

  const session = await getSession();
  if (!session || session.role !== "teacher") return new NextResponse("Unauthorized", { status: 401 });

  const [teacher, student] = await Promise.all([
    prisma.teacher.findUnique({ where: { id: Number(session.id) }, select: { id: true, role: true } }),
    prisma.student.findUnique({ where: { studentId }, select: { classroom: { select: { advisorId: true } } } }),
  ]);
  if (!teacher || !student) return new NextResponse("Not found", { status: 404 });
  if (teacher.role !== "admin" && student.classroom.advisorId !== teacher.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const photo = readStudentPhoto(studentId);
  if (!photo) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(photo), {
    headers: {
      "Content-Type": "image/jpeg",
      // private: browser may cache for the logged-in teacher, shared caches/CDNs must not
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
