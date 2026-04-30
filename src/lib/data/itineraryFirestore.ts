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
import type { Itinerary } from "@/lib/data/itineraryStore";

const COL = "itineraries";

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

export function subscribeItineraries(onRows: (rows: Itinerary[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL), orderBy("name", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: Itinerary[] = [];
      snap.forEach((d) => rows.push(d.data() as Itinerary));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function upsertItineraryFs(next: Itinerary) {
  const db = getFirebaseDb();
  const id = String(next.id || "").trim();
  if (!id) throw new Error("missing_id");
  await setDoc(doc(db, COL, id), stripUndefined(next), { merge: false });
}

export async function deleteItineraryFs(id: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL, String(id)));
}

