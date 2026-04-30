import { NextResponse } from "next/server";
import { getAdminServices } from "@/lib/firebase/adminServer";
import { requireSessionClaims } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

type CleanupResult = {
  ok: true;
  orphanWalletKeys: string[];
  deletedKeys?: string[];
  note: string;
};

async function listOrphanRosterWalletKeys(db: FirebaseFirestore.Firestore) {
  const driversSnap = await db.collection("drivers").get();
  const driverCodes = new Set<string>(driversSnap.docs.map((d) => String(d.id)));

  // Roster wallets are keyed by `emp:{employeeCode}` (doc id) and have source="roster".
  const walletsSnap = await db.collection("driverWallets").where("source", "==", "roster").get();
  const orphans: string[] = [];

  for (const doc of walletsSnap.docs) {
    const key = String(doc.id);
    if (!key.startsWith("emp:")) continue;
    const emp = key.slice("emp:".length);
    if (!emp) continue;
    if (!driverCodes.has(emp)) orphans.push(key);
  }

  orphans.sort((a, b) => a.localeCompare(b));
  return orphans;
}

export async function GET() {
  const claims = await requireSessionClaims();
  if ((claims as any)?.role !== "Admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { db } = getAdminServices();
  const orphanWalletKeys = await listOrphanRosterWalletKeys(db);
  const res: CleanupResult = {
    ok: true,
    orphanWalletKeys,
    note: "Orphans are roster wallets emp:* without a matching drivers/{employeeCode} doc.",
  };
  return NextResponse.json(res);
}

export async function POST() {
  const claims = await requireSessionClaims();
  if ((claims as any)?.role !== "Admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { db } = getAdminServices();
  const orphanWalletKeys = await listOrphanRosterWalletKeys(db);

  const deletedKeys: string[] = [];
  // Firestore batch limit is 500 writes; stay under it.
  let batch = db.batch();
  let count = 0;
  for (const key of orphanWalletKeys) {
    batch.delete(db.collection("driverWallets").doc(key));
    deletedKeys.push(key);
    count++;
    if (count >= 450) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();

  const res: CleanupResult = {
    ok: true,
    orphanWalletKeys,
    deletedKeys,
    note: "Deleted orphan roster wallets.",
  };
  return NextResponse.json(res);
}

