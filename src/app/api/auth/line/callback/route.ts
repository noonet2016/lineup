import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForProfile, verifyState } from "@/lib/line";
import { createSession, getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const loginUrl = (error: string) => new URL(`/login?error=${error}`, req.url);

  if (!code || !state) return NextResponse.redirect(loginUrl("missing_code"));

  const parsedState = verifyState(state);
  if (!parsedState) return NextResponse.redirect(loginUrl("bad_state"));

  let profile;
  try {
    profile = await exchangeCodeForProfile(code);
  } catch {
    return NextResponse.redirect(loginUrl("line_exchange_failed"));
  }

  if (parsedState.mode === "login") {
    const student = await prisma.student.findUnique({ where: { lineUserId: profile.userId } });
    if (student && student.status === 1) {
      await createSession("student", student.studentId);
      return NextResponse.redirect(new URL("/account", req.url));
    }
    const teacher = await prisma.teacher.findUnique({ where: { lineUserId: profile.userId } });
    if (teacher) {
      await createSession("teacher", String(teacher.id));
      return NextResponse.redirect(new URL("/account", req.url));
    }
    return NextResponse.redirect(loginUrl("line_not_linked"));
  }

  // mode === "bind": trust the CURRENT session (it survives the redirect round-trip as a cookie),
  // not any identity encoded in `state`.
  const session = await getSession();
  if (!session) return NextResponse.redirect(loginUrl("need_login_first"));

  try {
    if (session.role === "student") {
      await prisma.student.update({
        where: { studentId: session.id },
        data: { lineUserId: profile.userId, lineDisplayName: profile.displayName, linePictureUrl: profile.pictureUrl },
      });
    } else {
      await prisma.teacher.update({
        where: { id: Number(session.id) },
        data: { lineUserId: profile.userId, lineDisplayName: profile.displayName, linePictureUrl: profile.pictureUrl },
      });
    }
  } catch {
    // Unique constraint violation = this LINE account is already bound to a different user.
    return NextResponse.redirect(new URL("/account?error=line_already_bound", req.url));
  }

  return NextResponse.redirect(new URL("/account?bound=1", req.url));
}
