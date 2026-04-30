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
import type { Driver } from "@/lib/fleet/driverStore";

const COL = "drivers";

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
  await setDoc(doc(db, COL, id), next, { merge: false });
}

export async function deleteDriverFs(employeeCode: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL, String(employeeCode)));
}

