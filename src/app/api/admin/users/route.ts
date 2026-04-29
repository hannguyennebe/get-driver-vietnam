import { NextResponse } from "next/server";
import { getAdminServices, verifyAdminFromAuthHeader } from "@/lib/firebase/adminServer";

export const runtime = "nodejs";

type Role = "Admin" | "Accountant" | "Sales" | "Operator" | "Driver";

function phoneToSyntheticEmail(phone: string) {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  return `${digits}@phone.getdriver.local`;
}

function randomEmployeeCode(existing: Set<string>) {
  for (let i = 0; i < 50; i++) {
    const code = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
    if (!existing.has(code)) return code;
  }
  let n = 1;
  while (existing.has(String(n).padStart(5, "0"))) n++;
  return String(n).padStart(5, "0");
}

export async function GET(req: Request) {
  try {
    await verifyAdminFromAuthHeader(req.headers.get("authorization"));
    const { auth } = getAdminServices();
    const authUsers = await auth.listUsers(1000);

    const rows = authUsers.users.map((u) => {
      const role = ((u.customClaims?.role as Role | undefined) ?? "Operator") as Role;
      const perms = (u.customClaims as any)?.perms as
        | { view?: string[]; edit?: string[] }
        | undefined;
      return {
        uid: u.uid,
        employeeCode: "—",
        name: u.displayName ?? "—",
        phone: u.phoneNumber ?? "—",
        role,
        active: !u.disabled,
        permissions: {
          view: Array.from(new Set(perms?.view ?? [])),
          edit: Array.from(new Set(perms?.edit ?? [])),
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    });

    rows.sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ users: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    const status = msg === "unauthorized" ? 401 : msg === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdminFromAuthHeader(req.headers.get("authorization"));
    const { auth } = getAdminServices();
    const body = (await req.json()) as {
      name?: string;
      phone?: string;
      role?: Role;
      password?: string;
      permissions?: { view?: string[]; edit?: string[] };
    };
    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const role = (body.role ?? "Operator") as Role;
    const password = String(body.password ?? "");
    if (!name || !phone || password.length < 6) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const email = phoneToSyntheticEmail(phone);
    const employeeCode = randomEmployeeCode(new Set());

    const user = await auth.createUser({
      displayName: name,
      phoneNumber: phone,
      email,
      emailVerified: true,
      password,
      disabled: false,
    });
    const permissions = {
      view: Array.from(new Set(body.permissions?.view ?? [])),
      edit: Array.from(new Set(body.permissions?.edit ?? [])),
    };
    await auth.setCustomUserClaims(user.uid, {
      role,
      employeeCode,
      perms: permissions,
    });

    return NextResponse.json({ ok: true, uid: user.uid });
  } catch (e) {
    const anyErr = e as any;
    const code = String(
      anyErr?.errorInfo?.code ??
        anyErr?.code ??
        anyErr?.status ??
        anyErr?.statusCode ??
        anyErr?.message ??
        "failed",
    );
    const message = String(
      anyErr?.errorInfo?.message ?? anyErr?.message ?? "Unknown error",
    );
    console.error("[admin/users][POST] failed", { code, message, raw: anyErr });
    const status = code === "unauthorized" ? 401 : code === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: code, message }, { status });
  }
}

