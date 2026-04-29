import { getDemoSession } from "@/lib/auth/demo";

export type OtherExpenseCurrency = "VND" | "USD";

export type OtherExpense = {
  id: string;
  content: string;
  amount: number;
  currency: OtherExpenseCurrency;
  user: string; // demo session username
  createdAt: number;
  createdDate: string; // dd/mm/yyyy
  createdTime: string; // HH:mm
};

const KEY = "getdriver.finance.other-expenses.v1";

function safeParse(raw: string | null): OtherExpense[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OtherExpense[];
  } catch {
    return null;
  }
}

export function ensureOtherExpensesStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify([]));
}

export function listOtherExpenses(): OtherExpense[] {
  ensureOtherExpensesStore();
  return safeParse(localStorage.getItem(KEY)) ?? [];
}

export function addOtherExpense(input: {
  content: string;
  amount: number;
  currency: OtherExpenseCurrency;
}) {
  ensureOtherExpensesStore();
  const all = listOtherExpenses();
  const now = new Date();
  const session = getDemoSession();
  const next: OtherExpense = {
    id: `OE-${String(Date.now())}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    content: input.content.trim(),
    amount: input.amount,
    currency: input.currency,
    user: session?.username ?? "—",
    createdAt: Date.now(),
    createdDate: now.toLocaleDateString("vi-VN"),
    createdTime: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
  };
  localStorage.setItem(KEY, JSON.stringify([next, ...all]));
  return next;
}

