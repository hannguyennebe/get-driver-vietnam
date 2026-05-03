import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { getCurrentUserIdentity } from "@/lib/auth/currentUser";
import type { CashbookEntry } from "@/lib/finance/cashbookStore";
import { deleteCashbookEntryFs } from "@/lib/finance/cashbookFirestore";
import { adjustDriverWalletBalanceFs } from "@/lib/fleet/driverWalletsFirestore";

const COL = "cashbookUndoLogs";

export type CashbookUndoLog = {
  id: string;
  createdAt: number;
  createdDate: string;
  createdTime: string;
  createdBy: string;
  summary: string;
  removedEntryIds: string[];
  snapshots: CashbookEntry[];
};

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

export function isInternalCashbookMovement(e: Pick<CashbookEntry, "referenceType">): boolean {
  const t = String(e.referenceType || "").trim();
  return t === "WALLET_TRANSFER" || t === "INTERNAL_FUND_TRANSFER";
}

/**
 * Hoàn tác giao dịch nội bộ (vd: chuyển quỹ). Xóa các dòng sổ cùng nhóm, hoàn ví nếu có OUT từ ví.
 */
export async function undoInternalCashbookEntriesFs(
  entryId: string,
  allEntries: CashbookEntry[],
): Promise<void> {
  const target = allEntries.find((x) => x.id === entryId);
  if (!target) throw new Error("Không tìm thấy dòng sổ.");
  if (!isInternalCashbookMovement(target)) {
    throw new Error("Chỉ hoàn tác giao dịch nội bộ (chuyển quỹ).");
  }

  const refId = String(target.referenceId || "").trim();
  const group =
    refId.length > 0
      ? allEntries.filter(
          (e) =>
            isInternalCashbookMovement(e) &&
            String(e.referenceId || "").trim() === refId,
        )
      : [target];

  const snapshots = group.map((e) => ({ ...e }));

  for (const e of group) {
    const sid = String(e.sourceId || "");
    if (e.direction === "OUT" && sid.startsWith("WALLET:")) {
      const walletKey = sid.slice("WALLET:".length);
      const cur = String(e.currency || "VND").trim().toUpperCase() || "VND";
      const amt = Number(e.amount ?? 0) || 0;
      if (amt > 0) {
        await adjustDriverWalletBalanceFs(walletKey, cur, amt);
      }
    }
    await deleteCashbookEntryFs(e.id);
  }

  const now = new Date();
  const me = getCurrentUserIdentity();
  const logId = `UNDO-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  const log: CashbookUndoLog = {
    id: logId,
    createdAt: Date.now(),
    createdDate: now.toLocaleDateString("vi-VN"),
    createdTime: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    createdBy: me?.name ?? "—",
    summary:
      group.length > 1
        ? `Hoàn tác chuyển quỹ (${group.length} dòng)`
        : `Hoàn tác giao dịch nội bộ • ${target.content || ""}`,
    removedEntryIds: group.map((e) => e.id),
    snapshots,
  };
  await setDoc(doc(getFirebaseDb(), COL, logId), stripUndefined(log), { merge: false });
}

export function subscribeCashbookUndoLogs(onRows: (rows: CashbookUndoLog[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: CashbookUndoLog[] = [];
      snap.forEach((d) => rows.push(d.data() as CashbookUndoLog));
      onRows(rows);
    },
    () => onRows([]),
  );
}
