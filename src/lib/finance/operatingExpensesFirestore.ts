import { collection, doc, onSnapshot, orderBy, query, setDoc, type Unsubscribe } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { getCurrentUserIdentity } from "@/lib/auth/currentUser";
import type { OperatingExpense } from "@/lib/finance/operatingExpensesStore";

const COL = "operatingExpenses";

export function subscribeOperatingExpenses(onRows: (rows: OperatingExpense[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: OperatingExpense[] = [];
      snap.forEach((d) => rows.push(d.data() as OperatingExpense));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function addOperatingExpenseFs(
  input: Omit<OperatingExpense, "id" | "createdAt" | "createdBy" | "createdDate" | "createdTime">,
) {
  const db = getFirebaseDb();
  const now = new Date();
  const me = getCurrentUserIdentity();
  const next: OperatingExpense = {
    ...input,
    id: `OPE-${String(Date.now())}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    createdAt: Date.now(),
    createdBy: me?.name ?? "—",
    createdDate: now.toLocaleDateString("vi-VN"),
    createdTime: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
  await setDoc(doc(db, COL, next.id), next, { merge: false });
  return next;
}

