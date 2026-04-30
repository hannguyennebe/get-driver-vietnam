import { NextResponse } from "next/server";
import { getAdminServices } from "@/lib/firebase/adminServer";
import { requireSessionClaims } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

async function countCol(db: FirebaseFirestore.Firestore, col: string): Promise<number> {
  // Prefer aggregation count() if available.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snap = await (db.collection(col) as any).count().get();
    const n = Number(snap?.data?.()?.count ?? snap?.data?.count ?? snap?.count ?? 0);
    if (Number.isFinite(n)) return n;
  } catch {
    // ignore
  }

  // Fallback: sample up to 1000 docs (best-effort).
  const snap = await db.collection(col).limit(1000).get();
  return snap.size;
}

export async function GET() {
  const claims = await requireSessionClaims();
  if ((claims as any)?.role !== "Admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { db } = getAdminServices();
  const cols = [
    "reservations",
    "reservations_cancelled",
    "calendarTrips",
    "drivers",
    "driverWallets",
  ] as const;

  const counts: Record<string, number> = {};
  for (const c of cols) counts[c] = await countCol(db, c);

  const projectId =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any)?.app?.options?.projectId ??
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    null;

  return NextResponse.json({
    ok: true,
    projectId,
    counts,
    note: "Counts are computed by server (Admin SDK).",
  });
}

