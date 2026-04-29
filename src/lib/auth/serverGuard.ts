import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminServices } from "@/lib/firebase/adminServer";

const COOKIE_NAME = "getdriver_session";

export type ClaimsPermissions = { view?: string[]; edit?: string[] } | undefined;

export async function requireSessionClaims() {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;
  if (!session) redirect("/login");

  const { auth } = getAdminServices();
  try {
    const decoded = await auth.verifySessionCookie(session, true);
    return decoded as any;
  } catch {
    redirect("/login");
  }
}

export async function requireViewPermission(required: string | string[]) {
  const decoded = await requireSessionClaims();
  if (decoded?.role === "Admin") return decoded;

  const perms = (decoded as any)?.perms as ClaimsPermissions;
  const view = Array.isArray(perms?.view) ? perms!.view! : [];
  const needed = Array.isArray(required) ? required : [required];
  const ok = needed.some((p) => view.includes(p));
  if (!ok) redirect("/forbidden");
  return decoded;
}

