import { NextResponse } from "next/server";
import { getAdminServices } from "@/lib/firebase/adminServer";

export const runtime = "nodejs";

const COOKIE_NAME = "getdriver_session";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idToken?: string };
    const idToken = String(body.idToken ?? "").trim();
    if (!idToken) return NextResponse.json({ error: "bad_request" }, { status: 400 });

    const { auth } = getAdminServices();
    // 14 days
    const expiresIn = 14 * 24 * 60 * 60 * 1000;
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresIn / 1000),
    });
    return res;
  } catch (e) {
    const anyErr = e as any;
    const code = String(anyErr?.errorInfo?.code ?? anyErr?.code ?? "failed");
    const message = String(anyErr?.errorInfo?.message ?? anyErr?.message ?? "Unknown error");
    console.error("[auth/session][POST] failed", { code, message });
    return NextResponse.json({ error: code, message }, { status: 400 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

