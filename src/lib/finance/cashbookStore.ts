import { getDemoSession } from "@/lib/auth/demo";

// Fixed sources:
// - CASH / VAT_VND / NOVAT_VND / USD
// Dynamic sources:
// - WALLET:<walletKey> (ví tài xế)
export type CashbookSourceId = string;
export type CashbookDirection = "IN" | "OUT";
export type CashbookCurrency = string; // "VND" | "USD" | "AUD" | ...
export type CashbookMethod = "TM" | "CK";

export type CashbookEntry = {
  id: string;
  direction: CashbookDirection;
  sourceId: CashbookSourceId;
  currency: CashbookCurrency;
  amount: number;
  method: CashbookMethod;
  content: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: number;
  createdDate: string; // dd/mm/yyyy
  createdTime: string; // HH:mm
  createdBy: string;
};

const KEY = "getdriver.finance.cashbook.v1";

function safeParse(raw: string | null): CashbookEntry[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CashbookEntry[];
  } catch {
    return null;
  }
}

export function ensureCashbookStore() {
  if (typeof window === "undefined") return;
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify([]));
}

export function listCashbookEntries(): CashbookEntry[] {
  if (typeof window === "undefined") return [];
  ensureCashbookStore();
  return safeParse(localStorage.getItem(KEY)) ?? [];
}

export function addCashbookEntry(input: Omit<CashbookEntry, "id" | "createdAt" | "createdBy" | "createdDate" | "createdTime">) {
  if (typeof window === "undefined") throw new Error("server_call_not_allowed");
  ensureCashbookStore();
  const all = listCashbookEntries();
  const now = new Date();
  const session = getDemoSession();
  const next: CashbookEntry = {
    ...input,
    id: `CB-${String(Date.now())}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    createdAt: Date.now(),
    createdBy: session?.username ?? "—",
    createdDate: now.toLocaleDateString("vi-VN"),
    createdTime: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
  localStorage.setItem(KEY, JSON.stringify([next, ...all]));
  return next;
}

export function computeBalance(input: {
  sourceId: CashbookSourceId;
  currency: CashbookCurrency;
}) {
  if (typeof window === "undefined") return 0;
  const rows = listCashbookEntries().filter((e) => e.sourceId === input.sourceId && e.currency === input.currency);
  return rows.reduce((s, e) => s + (e.direction === "IN" ? e.amount : -e.amount), 0);
}

