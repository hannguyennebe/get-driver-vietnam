import { NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "getdriver_demo_session";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }

  try {
    const body = (await req.json()) as {
      username?: string;
      role?: string;
      permissions?: { view?: string[]; edit?: string[] };
    };
    const username = String(body.username ?? "").trim();
    const role = String(body.role ?? "Admin").trim() || "Admin";
    const permissions = body.permissions ?? { view: [], edit: [] };

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, JSON.stringify({ username, role, permissions }), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      // Keep short: demo only
      maxAge: 7 * 24 * 60 * 60,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
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

