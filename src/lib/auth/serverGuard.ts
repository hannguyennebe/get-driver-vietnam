import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminServices } from "@/lib/firebase/adminServer";

const COOKIE_NAME = "getdriver_session";
const DEMO_COOKIE_NAME = "getdriver_demo_session";

export type ClaimsPermissions = { view?: string[]; edit?: string[] } | undefined;

export async function requireSessionClaims() {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME)?.value;
  if (!session) {
    // Demo fallback: allow navigation when Firebase isn't configured.
    // This is intentionally disabled in production.
    if (process.env.NODE_ENV !== "production") {
      const demo = cookieStore.get(DEMO_COOKIE_NAME)?.value;
      if (demo) {
        try {
          const parsed = JSON.parse(demo) as {
            username?: string;
            role?: string;
            permissions?: { view?: string[]; edit?: string[] };
          };
          const perms = parsed.permissions ?? {};
          return {
            uid: `demo:${String(parsed.username ?? "").trim() || "user"}`,
            role: parsed.role ?? "Admin",
            perms: {
              view: Array.isArray(perms.view) ? perms.view : [],
              edit: Array.isArray(perms.edit) ? perms.edit : [],
            },
          } as any;
        } catch {
          // fall through to redirect
        }
      }
    }
    redirect("/login");
  }

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

