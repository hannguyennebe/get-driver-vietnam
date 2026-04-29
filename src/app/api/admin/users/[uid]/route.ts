import { NextResponse } from "next/server";
import { getAdminServices, verifyAdminFromAuthHeader } from "@/lib/firebase/adminServer";

export const runtime = "nodejs";

type Role = "Admin" | "Accountant" | "Sales" | "Operator" | "Driver";

function phoneToSyntheticEmail(phone: string) {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  return `${digits}@phone.getdriver.local`;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ uid: string }> },
) {
  try {
    await verifyAdminFromAuthHeader(req.headers.get("authorization"));
    const { uid } = await ctx.params;
    const { auth } = getAdminServices();
    const body = (await req.json()) as {
      name?: string;
      phone?: string;
      role?: Role;
      active?: boolean;
      permissions?: { view?: string[]; edit?: string[] };
    };

    if (typeof body.name === "string" && body.name.trim()) {
      await auth.updateUser(uid, { displayName: body.name.trim() });
    }
    if (typeof body.phone === "string" && body.phone.trim()) {
      const phone = body.phone.trim();
      await auth.updateUser(uid, {
        phoneNumber: phone,
        email: phoneToSyntheticEmail(phone),
        emailVerified: true,
      });
    }
    if (typeof body.active === "boolean") {
      await auth.updateUser(uid, { disabled: !body.active });
    }

    const existing = await auth.getUser(uid);
    const currentClaims = (existing.customClaims ?? {}) as Record<string, unknown>;
    const nextClaims: Record<string, unknown> = { ...currentClaims };
    if (typeof body.role === "string") nextClaims.role = body.role;
    if (body.permissions) {
      nextClaims.perms = {
        view: Array.from(new Set(body.permissions.view ?? [])),
        edit: Array.from(new Set(body.permissions.edit ?? [])),
      };
    }
    await auth.setCustomUserClaims(uid, nextClaims);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    const status = msg === "unauthorized" ? 401 : msg === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ uid: string }> },
) {
  try {
    await verifyAdminFromAuthHeader(req.headers.get("authorization"));
    const { uid } = await ctx.params;
    const { auth } = getAdminServices();
    await auth.updateUser(uid, { disabled: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    const status = msg === "unauthorized" ? 401 : msg === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

