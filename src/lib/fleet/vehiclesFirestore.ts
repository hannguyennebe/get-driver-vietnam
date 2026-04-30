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
import type { Vehicle } from "@/lib/fleet/vehicleStore";

const COL = "vehicles";

function normalizePlateId(plate: string) {
  // Firestore doc ids cannot contain '/', keep it simple and stable
  return String(plate || "").trim().replaceAll("/", "__");
}

export function subscribeVehicles(onRows: (rows: Vehicle[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL), orderBy("plate", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: Vehicle[] = [];
      snap.forEach((d) => rows.push(d.data() as Vehicle));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function upsertVehicleFs(next: Vehicle) {
  const db = getFirebaseDb();
  const plate = String(next.plate || "").trim();
  if (!plate) throw new Error("missing_plate");
  await setDoc(doc(db, COL, normalizePlateId(plate)), next, { merge: false });
}

export async function deleteVehicleFs(plate: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL, normalizePlateId(plate)));
}

