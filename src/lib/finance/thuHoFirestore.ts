import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { getCurrentUserIdentity } from "@/lib/auth/currentUser";
import type { ThuHoPayment } from "@/lib/finance/thuHoReportStore";

const COL = "thuHoPayments";
/** Bộ đếm mã phiếu GDV-REV — chỉ dùng cho luồng Báo cáo Thu Hộ (không dùng cho thu Phải Thu / Công nợ / TA khác). */
const REV_COUNTER_COL = "thuHoRevCounters";

/**
 * GDV-REV-YYMM-XXXXX — chỉ được gọi từ {@link addThuHoPaymentFs} (màn Báo cáo Thu Hộ).
 * YYMM = năm (2 số) + tháng tại lúc ghi nhận; XXXXX tăng trong cùng tháng dương lịch (không trùng giữa các năm).
 */
async function allocateThuHoReceiptCode(): Promise<string> {
  const db = getFirebaseDb();
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth() + 1;
  const yy = String(y % 100).padStart(2, "0");
  const mm = String(mo).padStart(2, "0");
  const periodKey = `${y}-${mm}`;
  const periodRef = doc(db, REV_COUNTER_COL, periodKey);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(periodRef);
    const prev = snap.exists() ? Number((snap.data() as { seq?: number }).seq ?? 0) : 0;
    const next = prev + 1;
    if (next > 99999) {
      throw new Error("Hết dải mã thu hộ trong tháng (tối đa 99.999).");
    }
    tx.set(periodRef, { seq: next, updatedAt: serverTimestamp() }, { merge: true });
    return `GDV-REV-${yy}${mm}-${String(next).padStart(5, "0")}`;
  });
}

export function subscribeThuHoPayments(onRows: (rows: ThuHoPayment[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: ThuHoPayment[] = [];
      snap.forEach((d) => rows.push(d.data() as ThuHoPayment));
      onRows(rows);
    },
    () => onRows([]),
  );
}

/**
 * Ghi nhận thu hộ có mã phiếu GDV-REV — **chỉ** dùng từ khối «Báo cáo Thu Hộ» (`/finance/thu`).
 * Không gọi hàm này cho các luồng thu tiền khác (Phải Thu, công nợ TA, …).
 */
export async function addThuHoPaymentFs(
  input: Omit<ThuHoPayment, "id" | "createdAt" | "createdBy" | "createdDate" | "createdTime" | "receiptCode">,
) {
  const db = getFirebaseDb();
  const now = new Date();
  const me = getCurrentUserIdentity();
  const receiptCode = await allocateThuHoReceiptCode();
  const next: ThuHoPayment = {
    ...input,
    receiptCode,
    id: `THUHO-${String(Date.now())}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    createdAt: Date.now(),
    createdBy: me?.name ?? "—",
    createdDate: now.toLocaleDateString("vi-VN"),
    createdTime: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
  await setDoc(doc(db, COL, next.id), next, { merge: false });
  return next;
}

export async function deleteThuHoPaymentFs(id: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, COL, id));
}

