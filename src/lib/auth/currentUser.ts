import { tryGetFirebaseAuth } from "@/lib/firebase/client";
import { getDemoSession } from "@/lib/auth/demo";

export type CurrentUserIdentity = {
  uid: string;
  name: string;
};

export function getCurrentUserIdentity(): CurrentUserIdentity | null {
  if (typeof window === "undefined") return null;
  const auth = tryGetFirebaseAuth();
  const u = auth?.currentUser ?? null;
  if (u?.uid) {
    const display =
      String(u.displayName || "").trim() ||
      String(u.phoneNumber || "").trim() ||
      String(u.email || "").trim() ||
      "—";
    return { uid: u.uid, name: display };
  }
  const demo = getDemoSession();
  if (demo?.username) {
    // Demo fallback: not secure for locking, but keeps UI usable if auth misconfigured.
    return { uid: `demo:${demo.username}`, name: demo.username };
  }
  return null;
}

