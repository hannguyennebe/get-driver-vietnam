import { getDemoSession } from "@/lib/auth/demo";
import type { Currency } from "@/lib/reservations/reservationStore";

export type ThuHoPaymentMethod = "TM" | "CK";

export type ThuHoPayment = {
  id: string;
  /** Mã booking (Reservation.code) mà khoản thu hộ thuộc về. */
  bookingCode: string;
  /** Travel Agent tại thời điểm ghi nhận (để nhìn nhanh). */
  travelAgentId?: string;
  travelAgentName?: string;
  currency: Currency;
  amount: number;
  method: ThuHoPaymentMethod;
  createdAt: number;
  createdDate: string; // dd/mm/yyyy
  createdTime: string; // HH:mm
  createdBy: string;
};

const KEY = "getdriver.finance.thuho.payments.v1";

function safeParse(raw: string | null): ThuHoPayment[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ThuHoPayment[];
  } catch {
    return null;
  }
}

export function ensureThuHoReportStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify([]));
}

export function listThuHoPayments(): ThuHoPayment[] {
  ensureThuHoReportStore();
  return safeParse(localStorage.getItem(KEY)) ?? [];
}

export function addThuHoPayment(input: {
  bookingCode: string;
  travelAgentId?: string;
  travelAgentName?: string;
  currency: Currency;
  amount: number;
  method: ThuHoPaymentMethod;
}) {
  ensureThuHoReportStore();
  const all = listThuHoPayments();
  const now = new Date();
  const session = getDemoSession();
  const next: ThuHoPayment = {
    id: `THUHO-${String(Date.now())}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    bookingCode: input.bookingCode,
    travelAgentId: input.travelAgentId || undefined,
    travelAgentName: input.travelAgentName?.trim() || undefined,
    currency: input.currency,
    amount: input.amount,
    method: input.method,
    createdAt: Date.now(),
    createdDate: now.toLocaleDateString("vi-VN"),
    createdTime: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    createdBy: session?.username ?? "—",
  };
  localStorage.setItem(KEY, JSON.stringify([next, ...all]));
  return next;
}

