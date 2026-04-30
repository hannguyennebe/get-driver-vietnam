import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { Driver } from "@/lib/fleet/driverStore";
import { rosterWalletKey } from "@/lib/fleet/driverWalletStore";

const COL = "drivers";
const WALLETS_COL = "driverWallets";

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

export function subscribeDrivers(onRows: (rows: Driver[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL), orderBy("employeeCode", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: Driver[] = [];
      snap.forEach((d) => rows.push(d.data() as Driver));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function upsertDriverFs(next: Driver) {
  const db = getFirebaseDb();
  const id = String(next.employeeCode || "").trim();
  if (!id) throw new Error("missing_employee_code");
  await setDoc(doc(db, COL, id), stripUndefined(next), { merge: false });
}

export async function deleteDriverFs(employeeCode: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL, String(employeeCode)));
}

/** Deleting a driver also deletes their roster wallet (`emp:{employeeCode}`). */
export async function deleteDriverAndWalletFs(employeeCode: string) {
  const db = getFirebaseDb();
  const id = String(employeeCode || "").trim();
  if (!id) throw new Error("missing_employee_code");
  const batch = writeBatch(db);
  batch.delete(doc(db, COL, id));
  batch.delete(doc(db, WALLETS_COL, rosterWalletKey(id)));
  await batch.commit();
}

