import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { appOrigin, buildAuthorizeUrl, signState, type OAuthMode } from "@/lib/line";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const mode = (req.nextUrl.searchParams.get("mode") ?? "login") as OAuthMode;
  if (mode !== "login" && mode !== "bind") {
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  }
  if (mode === "bind") {
    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(new URL("/login?error=need_login_first", appOrigin()));
    }
  }

  const nonce = crypto.randomBytes(16).toString("base64url");
  const state = signState(mode, nonce);
  return NextResponse.redirect(buildAuthorizeUrl(state));
}
