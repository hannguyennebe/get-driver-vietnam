import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { Quotation } from "@/lib/data/quotationStore";

const COL = "quotations";

export function subscribeQuotations(onRows: (rows: Quotation[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL), orderBy("updatedAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: Quotation[] = [];
      snap.forEach((d) => rows.push(d.data() as Quotation));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function getQuotationFs(id: string): Promise<Quotation | null> {
  const db = getFirebaseDb();
  const ref = doc(db, COL, String(id));
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Quotation) : null;
}

export async function upsertQuotationFs(next: Quotation) {
  const db = getFirebaseDb();
  const id = String(next.id || "").trim();
  if (!id) throw new Error("missing_id");
  await setDoc(doc(db, COL, id), next, { merge: false });
}

export async function deleteQuotationFs(id: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL, String(id)));
}

