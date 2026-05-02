import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { getCurrentUserIdentity } from "@/lib/auth/currentUser";
import type { CashbookEntry } from "@/lib/finance/cashbookStore";

const COL = "cashbookEntries";

function stripUndefined<T>(obj: T): T {
  // Firestore rejects `undefined` field values. This removes them recursively.
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as any;
  if (typeof obj !== "object") return obj;
  const out: any = {};
  for (const [k, v] of Object.entries(obj as any)) {
    if (v === undefined) continue;
    out[k] = stripUndefined(v);
  }
  return out as T;
}

export function subscribeCashbookEntries(onRows: (rows: CashbookEntry[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: CashbookEntry[] = [];
      snap.forEach((d) => rows.push(d.data() as CashbookEntry));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function addCashbookEntryFs(
  input: Omit<
    CashbookEntry,
    "id" | "createdAt" | "createdBy" | "createdDate" | "createdTime"
  >,
) {
  const db = getFirebaseDb();
  const now = new Date();
  const me = getCurrentUserIdentity();
  const next: CashbookEntry = {
    ...input,
    id: `CB-${String(Date.now())}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    createdAt: Date.now(),
    createdBy: me?.name ?? "—",
    createdDate: now.toLocaleDateString("vi-VN"),
    createdTime: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
  await setDoc(doc(db, COL, next.id), stripUndefined(next), { merge: false });
  return next;
}

export async function deleteCashbookEntryFs(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL, id));
}

