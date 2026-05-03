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
import { deleteApPaymentFs } from "@/lib/finance/apFirestore";
import { deleteDriverAdvanceFs } from "@/lib/finance/driverAdvancesFirestore";
import { deleteOperatingExpenseFs } from "@/lib/finance/operatingExpensesFirestore";
import { deleteOtherExpenseFs } from "@/lib/finance/otherExpensesFirestore";
import { adjustDriverWalletBalanceFs } from "@/lib/fleet/driverWalletsFirestore";
import type { ThuHoPayment } from "@/lib/finance/thuHoReportStore";
import { undoThuHoBookingFs } from "@/lib/finance/undoThuHoBooking";

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
 * Khi xóa một dòng sổ gắn ví: đảo tác động lên số dư Firestore (OUT nạp lại, IN trừ lại).
 */
export async function revertDriverWalletForRemovedCashbookLine(
  e: Pick<CashbookEntry, "sourceId" | "direction" | "amount" | "currency">,
): Promise<void> {
  const sid = String(e.sourceId || "");
  if (!sid.startsWith("WALLET:")) return;
  const walletKey = sid.slice("WALLET:".length);
  const cur = String(e.currency || "VND").trim().toUpperCase() || "VND";
  const amt = Number(e.amount ?? 0) || 0;
  if (amt <= 0) return;
  const delta = e.direction === "OUT" ? amt : -amt;
  await adjustDriverWalletBalanceFs(walletKey, cur, delta);
}

async function appendCashbookUndoLog(summary: string, removedEntryIds: string[], snapshots: CashbookEntry[]) {
  const now = new Date();
  const me = getCurrentUserIdentity();
  const logId = `UNDO-${Date.now()}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  const log: CashbookUndoLog = {
    id: logId,
    createdAt: Date.now(),
    createdDate: now.toLocaleDateString("vi-VN"),
    createdTime: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    createdBy: me?.name ?? "—",
    summary,
    removedEntryIds,
    snapshots,
  };
  await setDoc(doc(getFirebaseDb(), COL, logId), stripUndefined(log), { merge: false });
}

/**
 * Hoàn tác một dòng Thực Thu / Thực Chi (không phải chuyển quỹ nội bộ).
 * — Thu hộ (`ThuHo`): gọi luồng đầy đủ (sổ + thuHoPayments + hoàn ví).
 * — Gắn ví: đảo chiều số dư ví khi xóa dòng.
 */
export async function undoGeneralCashbookEntryFs(
  entryId: string,
  allEntries: CashbookEntry[],
  thuHoPayments: ThuHoPayment[],
): Promise<void> {
  const target = allEntries.find((x) => x.id === entryId);
  if (!target) throw new Error("Không tìm thấy dòng sổ.");
  if (isInternalCashbookMovement(target)) {
    throw new Error("Giao dịch chuyển quỹ nội bộ — dùng tab Nội bộ để hoàn tác theo nhóm.");
  }

  const rt = String(target.referenceType || "").trim();
  const rid = String(target.referenceId || "").trim();
  if (rt === "ThuHo" && rid) {
    const group = allEntries.filter(
      (e) => String(e.referenceType || "").trim() === "ThuHo" && String(e.referenceId || "").trim() === rid,
    );
    const snapshots = group.map((e) => ({ ...e }));
    const ids = group.map((e) => e.id);
    await undoThuHoBookingFs(rid, allEntries, thuHoPayments);
    await appendCashbookUndoLog(`Hoàn tác Thu hộ • ${rid} (${ids.length} dòng)`, ids, snapshots);
    return;
  }

  if (rt === "AP") {
    if (!rid.startsWith("PAY-")) {
      throw new Error(
        "Dòng thanh toán cũ (chưa gắn mã phiếu PAY). Không hoàn tác tự động được — điều chỉnh trên màn Phải trả hoặc nhập lại sau khi nâng cấp.",
      );
    }
    await deleteApPaymentFs(rid);
  } else if (rt === "OTHER_EXPENSE" && rid.startsWith("OEX-")) {
    await deleteOtherExpenseFs(rid);
  } else if (rt === "DRIVER_ADVANCE" && rid.startsWith("ADV-")) {
    await deleteDriverAdvanceFs(rid);
  } else if (rt === "OP_EXPENSE" && rid.startsWith("OPE-")) {
    await deleteOperatingExpenseFs(rid);
  }

  const snapshot = { ...target };
  await revertDriverWalletForRemovedCashbookLine(target);
  await deleteCashbookEntryFs(target.id);
  const label = target.direction === "IN" ? "Thực Thu" : "Thực Chi";
  await appendCashbookUndoLog(
    `Hoàn tác ${label} • ${target.content || target.id}`,
    [target.id],
    [snapshot],
  );
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
    await revertDriverWalletForRemovedCashbookLine(e);
    await deleteCashbookEntryFs(e.id);
  }

  await appendCashbookUndoLog(
    group.length > 1
      ? `Hoàn tác chuyển quỹ (${group.length} dòng)`
      : `Hoàn tác giao dịch nội bộ • ${target.content || ""}`,
    group.map((e) => e.id),
    snapshots,
  );
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
