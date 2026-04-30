import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  dispatchWalletKey,
  odCodeFromExternal,
  rosterWalletKey,
  walletNameFromDriverCode,
  type DriverWallet,
} from "@/lib/fleet/driverWalletStore";

const COL = "driverWallets";

export function subscribeDriverWallets(onRows: (rows: DriverWallet[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL), orderBy("walletName", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: DriverWallet[] = [];
      snap.forEach((d) => rows.push(d.data() as DriverWallet));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function upsertDriverWalletFs(next: DriverWallet) {
  const db = getFirebaseDb();
  const key = String(next.key || "").trim();
  if (!key) throw new Error("missing_wallet_key");
  await setDoc(doc(db, COL, key), next, { merge: false });
}

export async function deleteDriverWalletFs(key: string) {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL, String(key)));
}

export async function ensureWalletForRosterDriverFs(employeeCode: string, driverName: string) {
  const db = getFirebaseDb();
  const key = rosterWalletKey(employeeCode);
  const ref = doc(db, COL, key);
  const now = Date.now();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      const curr = snap.data() as DriverWallet;
      const expectedName = walletNameFromDriverCode(String(employeeCode));
      const next: DriverWallet = {
        ...curr,
        key,
        walletName: expectedName,
        source: "roster",
        employeeCode,
        driverName: driverName.trim(),
        balances: curr.balances ?? { VND: 0 },
        updatedAt: now,
      };
      tx.set(ref, next, { merge: false });
      return;
    }
    const wallet: DriverWallet = {
      key,
      walletName: walletNameFromDriverCode(String(employeeCode)),
      balances: { VND: 0 },
      source: "roster",
      employeeCode,
      driverName: driverName.trim(),
      createdAt: now,
      updatedAt: now,
    };
    tx.set(ref, wallet, { merge: false });
  });
}

export async function ensureWalletForExternalDispatchFs(
  driverName: string,
  phone: string,
  plate: string,
) {
  const db = getFirebaseDb();
  const key = dispatchWalletKey(phone, plate);
  const ref = doc(db, COL, key);
  const now = Date.now();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const expectedWalletName = walletNameFromDriverCode(odCodeFromExternal(phone, plate));
    if (snap.exists()) {
      const curr = snap.data() as DriverWallet;
      const next: DriverWallet = {
        ...curr,
        key,
        walletName: expectedWalletName,
        source: "dispatch",
        driverName: driverName.trim(),
        phone: phone.trim(),
        plate: plate.trim(),
        balances: curr.balances ?? { VND: 0 },
        updatedAt: now,
      };
      tx.set(ref, next, { merge: false });
      return;
    }
    const wallet: DriverWallet = {
      key,
      walletName: expectedWalletName,
      balances: { VND: 0 },
      source: "dispatch",
      driverName: driverName.trim(),
      phone: phone.trim(),
      plate: plate.trim(),
      createdAt: now,
      updatedAt: now,
    };
    tx.set(ref, wallet, { merge: false });
  });
}

export async function adjustDriverWalletBalanceFs(walletKey: string, currency: string, delta: number) {
  const db = getFirebaseDb();
  const ref = doc(db, COL, String(walletKey));
  const cur = String(currency || "VND").trim().toUpperCase() || "VND";
  const now = Date.now();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("wallet_not_found");
    const w = snap.data() as DriverWallet;
    const balances = { ...(w.balances ?? { VND: 0 }) };
    balances[cur] = (Number(balances[cur] ?? 0) || 0) + (Number(delta ?? 0) || 0);
    tx.set(ref, { balances, updatedAt: now } as any, { merge: true });
  });
}

