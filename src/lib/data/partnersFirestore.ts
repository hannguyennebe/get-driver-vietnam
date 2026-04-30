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
import type { Supplier, TravelAgent } from "@/lib/data/partnersStore";

const COL_TA = "partners_travelAgents";
const COL_SUP = "partners_suppliers";

function stripUndefined<T>(obj: T): T {
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

export function subscribeTravelAgents(onRows: (rows: TravelAgent[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL_TA), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: TravelAgent[] = [];
      snap.forEach((d) => rows.push(d.data() as TravelAgent));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export function subscribeSuppliers(onRows: (rows: Supplier[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL_SUP), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: Supplier[] = [];
      snap.forEach((d) => rows.push(d.data() as Supplier));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function getTravelAgent(id: string): Promise<TravelAgent | null> {
  const db = getFirebaseDb();
  const ref = doc(db, COL_TA, String(id));
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as TravelAgent) : null;
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const db = getFirebaseDb();
  const ref = doc(db, COL_SUP, String(id));
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Supplier) : null;
}

export async function upsertTravelAgentFs(next: TravelAgent) {
  const db = getFirebaseDb();
  const id = String(next.id || "").trim();
  if (!id) throw new Error("missing_id");
  await setDoc(doc(db, COL_TA, id), stripUndefined(next), { merge: false });
}

export async function deleteTravelAgentFs(id: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL_TA, String(id)));
}

export async function upsertSupplierFs(next: Supplier) {
  const db = getFirebaseDb();
  const id = String(next.id || "").trim();
  if (!id) throw new Error("missing_id");
  await setDoc(doc(db, COL_SUP, id), stripUndefined(next), { merge: false });
}

export async function deleteSupplierFs(id: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL_SUP, String(id)));
}

