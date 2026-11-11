import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { readStudentPhoto } from "@/lib/studentPhoto";

/**
 * Student school photo — the advisor of the student's classroom, the admin, or the student
 * themself. Students never get classmates' photos (team review 2026-11-11: official ID photos
 * of minors stay on teacher surfaces; /classroom-today shows class numbers instead).
 * Photos are PII and stored outside git/public (see src/lib/studentPhoto.ts).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;

  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  if (session.role === "student") {
    if (session.id !== studentId) return new NextResponse("Forbidden", { status: 403 });
    const photo = readStudentPhoto(studentId);
    if (!photo) return new NextResponse("Not found", { status: 404 });
    return photoResponse(photo);
  }
  if (session.role !== "teacher") return new NextResponse("Unauthorized", { status: 401 });

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

  return photoResponse(photo);
}

function photoResponse(photo: Buffer) {
  return new NextResponse(new Uint8Array(photo), {
    headers: {
      "Content-Type": "image/jpeg",
      // private: browser may cache for the logged-in teacher, shared caches/CDNs must not
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
