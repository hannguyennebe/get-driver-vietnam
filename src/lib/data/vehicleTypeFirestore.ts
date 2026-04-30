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
import type { VehicleType } from "@/lib/data/vehicleTypeStore";

const COL = "vehicleTypes";

export function subscribeVehicleTypes(onRows: (rows: VehicleType[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: VehicleType[] = [];
      snap.forEach((d) => rows.push(d.data() as VehicleType));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function upsertVehicleTypeFs(next: VehicleType) {
  const db = getFirebaseDb();
  const id = String(next.id || "").trim();
  if (!id) throw new Error("missing_id");
  await setDoc(doc(db, COL, id), next, { merge: false });
}

export async function deleteVehicleTypeFs(id: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL, String(id)));
}

