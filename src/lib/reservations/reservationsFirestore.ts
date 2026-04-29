import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { CancelledReservation, Reservation } from "@/lib/reservations/reservationStore";

type ReservationDoc = Reservation & {
  isCancelled?: boolean;
  cancelledAt?: number;
  cancelledBy?: string;
  cancelledFrom?: "reservation" | "calendar";
};

const COL = "reservations";

export function reservationDocId(code: string) {
  // Firestore doc ids cannot contain '/'
  return String(code || "").replaceAll("/", "__");
}

function toReservationDoc(r: Reservation): ReservationDoc {
  return {
    ...r,
    isCancelled: false,
  };
}

export async function getReservationByCode(code: string): Promise<Reservation | null> {
  const db = getFirebaseDb();
  const ref = doc(db, COL, reservationDocId(code));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as ReservationDoc;
  if (data.isCancelled) return null;
  return data as Reservation;
}

export function subscribeActiveReservations(
  onRows: (rows: Reservation[]) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(
    collection(db, COL),
    where("isCancelled", "==", false),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: Reservation[] = [];
      snap.forEach((d) => {
        rows.push(d.data() as Reservation);
      });
      onRows(rows);
    },
    () => onRows([]),
  );
}

export function subscribeCancelledReservations(
  onRows: (rows: CancelledReservation[]) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(
    collection(db, COL),
    where("isCancelled", "==", true),
    orderBy("cancelledAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: CancelledReservation[] = [];
      snap.forEach((d) => {
        rows.push(d.data() as CancelledReservation);
      });
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function createReservation(r: Reservation) {
  const db = getFirebaseDb();
  const ref = doc(db, COL, reservationDocId(r.code));
  // setDoc with {merge:false} behaves like create/overwrite; we rely on doc id uniqueness.
  await setDoc(ref, toReservationDoc(r));
}

export async function patchReservation(code: string, patch: Partial<Reservation>) {
  const db = getFirebaseDb();
  const ref = doc(db, COL, reservationDocId(code));
  const cleaned = Object.fromEntries(
    Object.entries(patch as Record<string, unknown>).filter(([, v]) => v !== undefined),
  );
  await updateDoc(ref, cleaned as any);
}

export async function cancelReservationFirestore(
  code: string,
  meta?: { cancelledBy?: string; cancelledFrom?: "reservation" | "calendar" },
) {
  const db = getFirebaseDb();
  const ref = doc(db, COL, reservationDocId(code));
  await updateDoc(ref, {
    isCancelled: true,
    cancelledAt: Date.now(),
    cancelledBy: meta?.cancelledBy ?? null,
    cancelledFrom: meta?.cancelledFrom ?? "reservation",
  } as any);
}

