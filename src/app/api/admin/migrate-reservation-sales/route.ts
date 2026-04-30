import { NextResponse } from "next/server";
import { getAdminServices } from "@/lib/firebase/adminServer";
import { requireSessionClaims } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

function digitsOnly(s: string) {
  return String(s || "").replace(/\D/g, "");
}

function looksLikePhone(s: string) {
  const d = digitsOnly(s);
  return d.length >= 9 && d.length <= 15;
}

async function buildPhoneToNameMap(auth: import("firebase-admin/auth").Auth) {
  const map = new Map<string, string>();
  let nextPageToken: string | undefined = undefined;
  // Vercel/serverless: keep bounded
  for (let page = 0; page < 10; page++) {
    const res = await auth.listUsers(1000, nextPageToken);
    for (const u of res.users) {
      const phoneDigits = digitsOnly(u.phoneNumber ?? "");
      const name = String(u.displayName ?? "").trim();
      if (phoneDigits && name) {
        map.set(phoneDigits, name);
      }
    }
    nextPageToken = res.pageToken;
    if (!nextPageToken) break;
  }
  return map;
}

async function computeMatches(input: {
  db: FirebaseFirestore.Firestore;
  phoneToName: Map<string, string>;
  limit: number;
}) {
  const snap = await input.db.collection("reservations").orderBy("createdAt", "desc").limit(input.limit).get();
  const matches: Array<{ id: string; code?: string; from: string; to: string; createdAt?: number }> = [];
  for (const d of snap.docs) {
    const data = d.data() as any;
    const salesRaw = String(data?.sales ?? "").trim();
    if (!salesRaw) continue;
    if (!looksLikePhone(salesRaw)) continue;
    const phoneDigits = digitsOnly(salesRaw);
    const name = input.phoneToName.get(phoneDigits);
    if (!name) continue;
    if (salesRaw === name) continue;
    matches.push({ id: d.id, code: data?.code, from: salesRaw, to: name, createdAt: data?.createdAt });
  }
  return matches;
}

export async function GET(req: Request) {
  const claims = await requireSessionClaims();
  if ((claims as any)?.role !== "Admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(2000, Number(url.searchParams.get("limit") ?? 500) || 500));
  const { db, auth } = getAdminServices();
  const phoneToName = await buildPhoneToNameMap(auth);
  const matches = await computeMatches({ db, phoneToName, limit });
  return NextResponse.json({
    ok: true,
    scanned: limit,
    matches,
    note: "Dry-run: reservations where sales looks like a phone and matches a staff phone are listed as from->to.",
  });
}

export async function POST(req: Request) {
  const claims = await requireSessionClaims();
  if ((claims as any)?.role !== "Admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.max(1, Math.min(5000, Number(body.limit ?? 2000) || 2000));
  const { db, auth } = getAdminServices();
  const phoneToName = await buildPhoneToNameMap(auth);
  const matches = await computeMatches({ db, phoneToName, limit });

  // Batch limit 500.
  let batch = db.batch();
  let count = 0;
  const updated: string[] = [];
  for (const m of matches) {
    batch.update(db.collection("reservations").doc(m.id), { sales: m.to });
    updated.push(m.id);
    count++;
    if (count >= 450) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();

  return NextResponse.json({
    ok: true,
    scanned: limit,
    updatedCount: updated.length,
    updatedIds: updated.slice(0, 50),
    note: "Applied: updated reservation.sales from phone to staff displayName when matched by phoneNumber.",
  });
}

