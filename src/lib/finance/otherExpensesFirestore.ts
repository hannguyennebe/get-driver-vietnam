import { collection, doc, onSnapshot, orderBy, query, setDoc, type Unsubscribe } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { getCurrentUserIdentity } from "@/lib/auth/currentUser";
import type { OtherExpense } from "@/lib/finance/otherExpensesStore";

const COL = "otherExpenses";

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

export function subscribeOtherExpenses(onRows: (rows: OtherExpense[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: OtherExpense[] = [];
      snap.forEach((d) => rows.push(d.data() as OtherExpense));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function addOtherExpenseFs(input: Omit<OtherExpense, "id" | "createdAt" | "user" | "createdDate" | "createdTime">) {
  const db = getFirebaseDb();
  const now = new Date();
  const me = getCurrentUserIdentity();
  const next: OtherExpense = {
    ...input,
    id: `OEX-${String(Date.now())}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    createdAt: Date.now(),
    user: me?.name ?? "—",
    createdDate: now.toLocaleDateString("vi-VN"),
    createdTime: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
  await setDoc(doc(db, COL, next.id), stripUndefined(next), { merge: false });
  return next;
}

