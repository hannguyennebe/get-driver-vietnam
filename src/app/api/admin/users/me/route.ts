import { NextResponse } from "next/server";
import { getAdminServices } from "@/lib/firebase/adminServer";

export const runtime = "nodejs";

type Role = "Admin" | "Accountant" | "Sales" | "Operator" | "Driver";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const idToken = match?.[1];
    if (!idToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { auth } = getAdminServices();
    const decoded = await auth.verifyIdToken(idToken);
    const user = await auth.getUser(decoded.uid);
    const perms = (decoded as any)?.perms as
      | { view?: string[]; edit?: string[] }
      | undefined;

    return NextResponse.json({
      uid: decoded.uid,
      name: user.displayName ?? null,
      phone: user.phoneNumber ?? null,
      employeeCode: (decoded as any)?.employeeCode ?? null,
      role: (decoded.role as Role | undefined) ?? "Operator",
      active: !user.disabled,
      permissions: {
        view: Array.from(new Set(perms?.view ?? [])),
        edit: Array.from(new Set(perms?.edit ?? [])),
      },
    });
  } catch (e) {
    const anyErr = e as any;
    const code = String(anyErr?.errorInfo?.code ?? anyErr?.code ?? "failed");
    const message = String(
      anyErr?.errorInfo?.message ?? anyErr?.message ?? "Unknown error",
    );
    return NextResponse.json({ error: code, message }, { status: 400 });
  }
}

