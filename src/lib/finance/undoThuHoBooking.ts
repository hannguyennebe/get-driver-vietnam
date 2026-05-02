import type { CashbookEntry } from "@/lib/finance/cashbookStore";
import type { ThuHoPayment } from "@/lib/finance/thuHoReportStore";
import { deleteCashbookEntryFs } from "@/lib/finance/cashbookFirestore";
import { deleteThuHoPaymentFs } from "@/lib/finance/thuHoFirestore";
import { adjustDriverWalletBalanceFs } from "@/lib/fleet/driverWalletsFirestore";

/**
 * Xóa toàn bộ ghi nhận Thu hộ trên Firestore cho một booking:
 * hoàn tác nạp ví (trừ lại), xóa dòng sổ quỹ và bản ghi thuHoPayments.
 */
export async function undoThuHoBookingFs(
  bookingCode: string,
  cashbook: CashbookEntry[],
  thuHoPayments: ThuHoPayment[],
): Promise<void> {
  const code = String(bookingCode || "").trim();
  if (!code) throw new Error("missing_booking_code");

  const cbRows = cashbook.filter(
    (e) => e.referenceType === "ThuHo" && String(e.referenceId || "").trim() === code,
  );
  const payRows = thuHoPayments.filter((p) => String(p.bookingCode || "").trim() === code);

  for (const e of cbRows) {
    if (e.direction !== "IN") continue;
    const sid = String(e.sourceId || "");
    if (!sid.startsWith("WALLET:")) continue;
    const walletKey = sid.slice("WALLET:".length);
    const cur = String(e.currency || "VND").trim().toUpperCase() || "VND";
    const amt = Number(e.amount ?? 0) || 0;
    if (amt <= 0) continue;
    await adjustDriverWalletBalanceFs(walletKey, cur, -amt);
  }

  for (const e of cbRows) {
    await deleteCashbookEntryFs(e.id);
  }
  for (const p of payRows) {
    await deleteThuHoPaymentFs(p.id);
  }
}
