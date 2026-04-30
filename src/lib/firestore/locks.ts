import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

export type LockResource =
  | "reservations"
  | "travelAgents"
  | "suppliers"
  | "itineraries"
  | "vehicleTypes"
  | "drivers"
  | "vehicles"
  | "driverWallets"
  | "quotations"
  | "contractsNt"
  | "finance";

export type DocLock = {
  resource: LockResource;
  resourceId: string;
  ownerUid: string;
  ownerName: string;
  acquiredAtMs: number;
  expiresAtMs: number;
  updatedAt: unknown;
};

export type AcquireLockResult =
  | { ok: true; lockId: string; lock: DocLock }
  | {
      ok: false;
      reason: "locked";
      lockId: string;
      lock: Pick<DocLock, "ownerUid" | "ownerName" | "acquiredAtMs" | "expiresAtMs">;
    };

const LOCKS_COL = "locks";

export function lockDocId(resource: LockResource, resourceId: string) {
  const r = String(resource || "").trim();
  const id = String(resourceId || "").trim();
  return `${r}:${id}`;
}

export function subscribeLock(
  db: Firestore,
  resource: LockResource,
  resourceId: string,
  onLock: (lock: DocLock | null) => void,
): Unsubscribe {
  const ref = doc(db, LOCKS_COL, lockDocId(resource, resourceId));
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return onLock(null);
      onLock(snap.data() as DocLock);
    },
    () => onLock(null),
  );
}

export async function acquireLock(input: {
  resource: LockResource;
  resourceId: string;
  ownerUid: string;
  ownerName: string;
  leaseMs?: number;
  nowMs?: number;
}): Promise<AcquireLockResult> {
  const db = getFirebaseDb();
  const leaseMs = clampMs(input.leaseMs ?? 2 * 60 * 1000, 30_000, 10 * 60 * 1000); // 0.5–10 min
  const nowMs = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();

  const id = lockDocId(input.resource, input.resourceId);
  const ref = doc(db, LOCKS_COL, id);

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists() ? (snap.data() as Partial<DocLock>) : null;
    const existingOwnerUid = String(existing?.ownerUid ?? "").trim();
    const expiresAtMs = Number(existing?.expiresAtMs ?? 0) || 0;
    const expired = expiresAtMs > 0 && expiresAtMs <= nowMs;

    if (existing && !expired && existingOwnerUid && existingOwnerUid !== input.ownerUid) {
      return {
        ok: false,
        reason: "locked",
        lockId: id,
        lock: {
          ownerUid: existingOwnerUid,
          ownerName: String(existing?.ownerName ?? "—"),
          acquiredAtMs: Number(existing?.acquiredAtMs ?? 0) || 0,
          expiresAtMs,
        },
      } as const;
    }

    const next: DocLock = {
      resource: input.resource,
      resourceId: input.resourceId,
      ownerUid: input.ownerUid,
      ownerName: String(input.ownerName || "—").trim() || "—",
      acquiredAtMs: existing && !expired ? Number(existing?.acquiredAtMs ?? nowMs) || nowMs : nowMs,
      expiresAtMs: nowMs + leaseMs,
      updatedAt: serverTimestamp(),
    };
    tx.set(ref, next, { merge: false });
    return { ok: true, lockId: id, lock: next } as const;
  });
}

export async function renewLock(input: {
  resource: LockResource;
  resourceId: string;
  ownerUid: string;
  leaseMs?: number;
  nowMs?: number;
}) {
  const db = getFirebaseDb();
  const leaseMs = clampMs(input.leaseMs ?? 2 * 60 * 1000, 30_000, 10 * 60 * 1000);
  const nowMs = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();
  const id = lockDocId(input.resource, input.resourceId);
  const ref = doc(db, LOCKS_COL, id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const existing = snap.data() as Partial<DocLock>;
    const ownerUid = String(existing?.ownerUid ?? "").trim();
    if (!ownerUid || ownerUid !== input.ownerUid) return;
    tx.set(
      ref,
      {
        expiresAtMs: nowMs + leaseMs,
        updatedAt: serverTimestamp(),
      } as any,
      { merge: true },
    );
  });
}

export async function releaseLock(input: {
  resource: LockResource;
  resourceId: string;
  ownerUid: string;
}) {
  const db = getFirebaseDb();
  const id = lockDocId(input.resource, input.resourceId);
  const ref = doc(db, LOCKS_COL, id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const existing = snap.data() as Partial<DocLock>;
    const ownerUid = String(existing?.ownerUid ?? "").trim();
    if (!ownerUid || ownerUid !== input.ownerUid) return;
    tx.delete(ref);
  });
}

function clampMs(v: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

