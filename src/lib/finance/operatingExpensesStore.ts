export type OperatingPaymentMethod = "TM" | "CK" | "Ví tài xế";

export type OperatingExpenseType =
  | "VETC"
  | "Nhiên Liệu"
  | "Bảo Dưỡng"
  | "Thay Dầu";

export type OperatingExpense = {
  id: string;
  type: OperatingExpenseType;
  vehiclePlate?: string; // for non-VETC
  amountVnd: number;
  paymentMethod: OperatingPaymentMethod;
  createdAt: number;
  createdDate: string; // dd/mm/yyyy
  createdTime: string; // HH:mm
  createdBy: string;
};

const KEY = "getdriver.finance.operating-expenses.v1";

function safeParse(raw: string | null): OperatingExpense[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OperatingExpense[];
  } catch {
    return null;
  }
}

export function ensureOperatingExpensesStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify([]));
}

export function listOperatingExpenses(): OperatingExpense[] {
  ensureOperatingExpensesStore();
  return safeParse(localStorage.getItem(KEY)) ?? [];
}

export function addOperatingExpense(input: Omit<OperatingExpense, "id" | "createdAt">) {
  ensureOperatingExpensesStore();
  const all = listOperatingExpenses();
  const next: OperatingExpense = {
    ...input,
    id: `OP-${String(Date.now())}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    createdAt: Date.now(),
  };
  localStorage.setItem(KEY, JSON.stringify([next, ...all]));
  return next;
}

