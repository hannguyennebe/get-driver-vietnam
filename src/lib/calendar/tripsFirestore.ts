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
import type { Trip } from "@/lib/calendar/tripsStore";

const COL = "calendarTrips";

export function subscribeCalendarTrips(onRows: (rows: Trip[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL), orderBy("date", "asc"), orderBy("time", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: Trip[] = [];
      snap.forEach((d) => rows.push(d.data() as Trip));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function upsertCalendarTripFs(next: Trip) {
  const db = getFirebaseDb();
  const id = String(next.id || "").trim();
  if (!id) throw new Error("missing_id");
  await setDoc(doc(db, COL, id), next, { merge: false });
}

export async function deleteCalendarTripFs(id: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL, String(id)));
}

