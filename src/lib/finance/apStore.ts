import { getDemoSession } from "@/lib/auth/demo";

export type Currency = "VND" | "USD";
export type PaymentMethod = "TM" | "CK";

export type Period = { month: number; year: number }; // month: 1..12

export type RecurringExpenseTemplate = {
  id: string;
  /** Tên loại chi phí (do người dùng đặt), dùng cho hiển thị và nhóm kỳ phát sinh. */
  name: string;
  defaultAmountVnd?: number;
  currency: Currency;
  /** Ngày trong tháng thanh toán tiền (1–31). */
  dueDayOfMonth: number; // 1..31
  /**
   * Quan hệ kỳ chi phí ↔ tháng chứa ngày hạn thanh toán:
   * Lặp theo từng **tháng thanh toán** M; kỳ ghi nhận = `addMonths(M, accrualMonthOffset)`.
   * `0` = kỳ trùng tháng thanh toán (vd. trả ngày 05/05 cho chi phí tháng 5).
   * `-1` = kỳ là tháng ngay trước tháng thanh toán (vd. trả ngày 10/05 cho chi phí tháng 4 — lương).
   */
  accrualMonthOffset: 0 | -1;
  active: boolean;
  startPeriod: Period; // effective from (accrual period)
  endPeriod?: Period; // contract end (accrual period)
  finalizedAt?: number; // ended early or settled
  finalizedBy?: string;
  finalizedEffectiveTo?: Period; // stop generating after this accrual period
  createdAt: number;
  updatedAt: number;
};

export type AccrualPeriod = Period;

export type ExpenseStatus = "Unpaid" | "PartiallyPaid" | "Paid" | "Cancelled";

export type ExpenseInstance = {
  id: string;
  templateId?: string;
  name: string;
  /** Loại phân loại (ghi chú ngắn); thường trùng tên khoản hoặc "Khác". */
  category: string;
  amountVnd: number;
  currency: Currency;
  accrualPeriod: AccrualPeriod;
  dueDateISO: string; // yyyy-mm-dd
  note?: string;
  status: ExpenseStatus;
  createdAt: number;
  createdBy: string;
};

export type PaymentTransaction = {
  id: string;
  expenseId: string;
  paidAtISO: string; // yyyy-mm-dd
  amountVnd: number;
  currency: Currency;
  method: PaymentMethod;
  reference?: string;
  createdAt: number;
  createdBy: string;
};

const TPL_KEY = "getdriver.finance.ap.templates.v1";
const EXP_KEY = "getdriver.finance.ap.expenses.v1";
const PAY_KEY = "getdriver.finance.ap.payments.v1";

const DEFAULT_START: Period = { month: 1, year: 2026 };

const SEED_TEMPLATES: RecurringExpenseTemplate[] = [
  {
    id: "TPL-OFFICE-RENT",
    name: "Thuê văn phòng",
    defaultAmountVnd: 0,
    currency: "VND",
    dueDayOfMonth: 5,
    accrualMonthOffset: 0,
    active: true,
    startPeriod: DEFAULT_START,
    endPeriod: undefined,
    finalizedAt: undefined,
    finalizedBy: undefined,
    finalizedEffectiveTo: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "TPL-OFFICE-PAYROLL",
    name: "Lương văn phòng",
    defaultAmountVnd: 0,
    currency: "VND",
    dueDayOfMonth: 10,
    accrualMonthOffset: -1,
    active: true,
    startPeriod: DEFAULT_START,
    endPeriod: undefined,
    finalizedAt: undefined,
    finalizedBy: undefined,
    finalizedEffectiveTo: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "TPL-BANK-FEE",
    name: "Phí ngân hàng",
    defaultAmountVnd: 0,
    currency: "VND",
    dueDayOfMonth: 25,
    accrualMonthOffset: 0,
    active: true,
    startPeriod: DEFAULT_START,
    endPeriod: undefined,
    finalizedAt: undefined,
    finalizedBy: undefined,
    finalizedEffectiveTo: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function ensureApStore() {
  const existingTpl = safeParse<RecurringExpenseTemplate[]>(localStorage.getItem(TPL_KEY));
  if (!existingTpl) {
    localStorage.setItem(TPL_KEY, JSON.stringify(SEED_TEMPLATES));
  } else {
    // Migration: backfill new fields if missing.
    const migrated = existingTpl.map((t: any) => {
      const cat = t.category as string | undefined;
      const defaultDue =
        cat === "OfficeRent" ? 5 : cat === "OfficePayroll" ? 10 : cat === "BankFee" ? 25 : 5;
      const defaultOffset: 0 | -1 = cat === "OfficePayroll" ? -1 : 0;
      const { category: _removed, ...rest } = t;
      return {
        ...rest,
        startPeriod: isPeriod(t.startPeriod) ? t.startPeriod : DEFAULT_START,
        endPeriod: isPeriod(t.endPeriod) ? t.endPeriod : undefined,
        finalizedAt: typeof t.finalizedAt === "number" ? t.finalizedAt : undefined,
        finalizedBy: typeof t.finalizedBy === "string" ? t.finalizedBy : undefined,
        finalizedEffectiveTo: isPeriod(t.finalizedEffectiveTo) ? t.finalizedEffectiveTo : undefined,
        active: typeof t.active === "boolean" ? t.active : true,
        name: typeof t.name === "string" && t.name.trim() ? t.name.trim() : "Chi phí văn phòng",
        dueDayOfMonth:
          typeof t.dueDayOfMonth === "number" && t.dueDayOfMonth >= 1 && t.dueDayOfMonth <= 31
            ? t.dueDayOfMonth
            : defaultDue,
        accrualMonthOffset:
          t.accrualMonthOffset === -1 || t.accrualMonthOffset === 0
            ? t.accrualMonthOffset
            : defaultOffset,
      };
    }) as RecurringExpenseTemplate[];
    localStorage.setItem(TPL_KEY, JSON.stringify(migrated));
  }
  if (!safeParse<ExpenseInstance[]>(localStorage.getItem(EXP_KEY))) {
    localStorage.setItem(EXP_KEY, JSON.stringify([]));
  }
  if (!safeParse<PaymentTransaction[]>(localStorage.getItem(PAY_KEY))) {
    localStorage.setItem(PAY_KEY, JSON.stringify([]));
  }
}

export function listTemplates() {
  ensureApStore();
  return safeParse<RecurringExpenseTemplate[]>(localStorage.getItem(TPL_KEY)) ?? [];
}

/** Ngày hạn thanh toán (ISO) cho một kỳ chi phí, theo quy tắc danh mục. */
export function dueDateISOForTemplateAccrual(
  accrual: AccrualPeriod,
  tpl: Pick<RecurringExpenseTemplate, "dueDayOfMonth" | "accrualMonthOffset">,
): string {
  const pm = addMonths(accrual.year, accrual.month, -tpl.accrualMonthOffset);
  return toIsoDate(pm.year, pm.month, clampDay(pm.year, pm.month, tpl.dueDayOfMonth));
}

export function upsertTemplate(tpl: RecurringExpenseTemplate) {
  ensureApStore();
  const all = listTemplates();
  const idx = all.findIndex((x) => x.id === tpl.id);
  const next = idx >= 0 ? all.map((x) => (x.id === tpl.id ? tpl : x)) : [tpl, ...all];
  localStorage.setItem(TPL_KEY, JSON.stringify(next));
  reconcileUnpaidDueDatesForTemplate(tpl.id);
}

/** Đồng bộ hạn TT, tên khoản và loại (category) của các kỳ chưa trả / chưa huỷ khi sửa danh mục. */
export function reconcileUnpaidDueDatesForTemplate(templateId: string) {
  ensureApStore();
  const tpl = listTemplates().find((x) => x.id === templateId);
  if (!tpl) return;
  const expenses = listExpenses();
  let changed = false;
  const updated = expenses.map((e) => {
    if (e.templateId !== templateId) return e;
    if (e.status === "Paid" || e.status === "Cancelled") return e;
    const nextDue = dueDateISOForTemplateAccrual(e.accrualPeriod, tpl);
    const nextName = tpl.name.trim() || e.name;
    const nextCat = nextName;
    if (
      nextDue === e.dueDateISO &&
      nextName === e.name &&
      nextCat === e.category
    )
      return e;
    changed = true;
    return {
      ...e,
      dueDateISO: nextDue,
      name: nextName,
      category: nextCat,
    };
  });
  if (changed) localStorage.setItem(EXP_KEY, JSON.stringify(updated));
}

export function describeTemplatePaymentRule(tpl: RecurringExpenseTemplate): string {
  const d = tpl.dueDayOfMonth;
  if (tpl.accrualMonthOffset === -1) {
    return `Ngày ${d} — kỳ chi phí là tháng liền trước tháng chứa ngày hạn`;
  }
  return `Ngày ${d} — kỳ chi phí trùng với tháng chứa ngày hạn thanh toán`;
}

export function listExpenses() {
  ensureApStore();
  return safeParse<ExpenseInstance[]>(localStorage.getItem(EXP_KEY)) ?? [];
}

export function listPayments() {
  ensureApStore();
  return safeParse<PaymentTransaction[]>(localStorage.getItem(PAY_KEY)) ?? [];
}

export function upsertExpense(expense: ExpenseInstance) {
  const all = listExpenses();
  const idx = all.findIndex((x) => x.id === expense.id);
  const next = idx >= 0 ? all.map((x) => (x.id === expense.id ? expense : x)) : [expense, ...all];
  localStorage.setItem(EXP_KEY, JSON.stringify(next));
}

export function addManualExpense(input: {
  name: string;
  category: string;
  amountVnd: number;
  accrualPeriod: AccrualPeriod;
  dueDateISO: string;
  note?: string;
}) {
  ensureApStore();
  const session = getDemoSession();
  const now = Date.now();
  const expense: ExpenseInstance = {
    id: `EXP-${now}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    templateId: undefined,
    name: input.name.trim(),
    category: input.category,
    amountVnd: input.amountVnd,
    currency: "VND",
    accrualPeriod: input.accrualPeriod,
    dueDateISO: input.dueDateISO,
    note: input.note,
    status: "Unpaid",
    createdAt: now,
    createdBy: session?.username ?? "—",
  };
  const all = listExpenses();
  localStorage.setItem(EXP_KEY, JSON.stringify([expense, ...all]));
  return expense;
}

export function addPayment(input: {
  expenseId: string;
  paidAtISO: string;
  amountVnd: number;
  method: PaymentMethod;
  reference?: string;
}) {
  ensureApStore();
  const session = getDemoSession();
  const now = Date.now();
  const payment: PaymentTransaction = {
    id: `PAY-${now}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    expenseId: input.expenseId,
    paidAtISO: input.paidAtISO,
    amountVnd: input.amountVnd,
    currency: "VND",
    method: input.method,
    reference: input.reference?.trim() || undefined,
    createdAt: now,
    createdBy: session?.username ?? "—",
  };

  const payments = listPayments();
  localStorage.setItem(PAY_KEY, JSON.stringify([payment, ...payments]));

  // Recompute expense status.
  const expenses = listExpenses();
  const exp = expenses.find((x) => x.id === input.expenseId);
  if (exp && exp.status !== "Cancelled") {
    const paid = listPayments()
      .filter((p) => p.expenseId === exp.id)
      .reduce((s, p) => s + (p.amountVnd || 0), 0);
    const status: ExpenseStatus =
      paid <= 0 ? "Unpaid" : paid >= exp.amountVnd ? "Paid" : "PartiallyPaid";
    upsertExpense({ ...exp, status });
  }
  return payment;
}

export function finalizeTemplateEarly(input: {
  templateId: string;
  effectiveTo: Period; // accrual period: stop after this
}) {
  ensureApStore();
  const session = getDemoSession();
  const templates = listTemplates();
  const tpl = templates.find((x) => x.id === input.templateId);
  if (!tpl) throw new Error("not_found");

  const nextTpl: RecurringExpenseTemplate = {
    ...tpl,
    finalizedAt: Date.now(),
    finalizedBy: session?.username ?? "—",
    finalizedEffectiveTo: input.effectiveTo,
    active: false,
    updatedAt: Date.now(),
  };
  upsertTemplate(nextTpl);

  // Cancel future expense instances (soft cancel)
  const expenses = listExpenses();
  const updated = expenses.map((e) => {
    if (e.templateId !== input.templateId) return e;
    if (!comparePeriod(e.accrualPeriod, input.effectiveTo).gt) return e;
    if (e.status === "Paid") return e;
    return { ...e, status: "Cancelled" as const };
  });
  localStorage.setItem(EXP_KEY, JSON.stringify(updated));
  return nextTpl;
}

export function ensureRecurringExpensesForRange(input: {
  fromYear: number;
  fromMonth: number; // 1..12
  toYear: number;
  toMonth: number; // 1..12
}) {
  ensureApStore();
  const templates = listTemplates();
  const existing = listExpenses();
  const existsKey = new Set(
    existing
      .filter((e) => e.templateId)
      .map((e) => `${e.templateId}:${e.accrualPeriod.year}-${e.accrualPeriod.month}`),
  );

  const months = enumerateMonths(input.fromYear, input.fromMonth, input.toYear, input.toMonth);
  const session = getDemoSession();

  const next: ExpenseInstance[] = [];
  for (const m of months) {
    for (const tpl of templates) {
      const effectiveTo = tpl.finalizedEffectiveTo ?? tpl.endPeriod;
      // inactive templates should not generate anything new
      if (!tpl.active) continue;
      const accrual = addMonths(m.year, m.month, tpl.accrualMonthOffset); // period that cost belongs to
      // Must be within start/end range (accrual period)
      if (comparePeriod(accrual, tpl.startPeriod).lt) continue;
      if (tpl.endPeriod && comparePeriod(accrual, tpl.endPeriod).gt) continue;
      if (tpl.finalizedEffectiveTo && comparePeriod(accrual, tpl.finalizedEffectiveTo).gt) continue;
      const key = `${tpl.id}:${accrual.year}-${accrual.month}`;
      if (existsKey.has(key)) continue;

      const dueDateISO = dueDateISOForTemplateAccrual(accrual, tpl);
      next.push({
        id: `EXP-${tpl.id}-${accrual.year}-${String(accrual.month).padStart(2, "0")}`,
        templateId: tpl.id,
        name: tpl.name,
        category: tpl.name,
        amountVnd: tpl.defaultAmountVnd ?? 0,
        currency: tpl.currency,
        accrualPeriod: accrual,
        dueDateISO,
        status: "Unpaid",
        createdAt: Date.now(),
        createdBy: session?.username ?? "—",
      });
      existsKey.add(key);
    }
  }

  if (next.length > 0) {
    localStorage.setItem(EXP_KEY, JSON.stringify([...next, ...existing]));
  }
}

function enumerateMonths(fromY: number, fromM: number, toY: number, toM: number) {
  const out: Array<{ year: number; month: number }> = [];
  let y = fromY;
  let m = fromM;
  while (y < toY || (y === toY && m <= toM)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function addMonths(year: number, month: number, delta: number) {
  // month 1..12
  let y = year;
  let m = month + delta;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

function toIsoDate(year: number, month: number, day: number) {
  const y = String(year);
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function clampDay(year: number, month: number, day: number) {
  const max = new Date(year, month, 0).getDate();
  return Math.max(1, Math.min(day, max));
}

function isPeriod(p: any): p is Period {
  return (
    p &&
    typeof p === "object" &&
    typeof p.month === "number" &&
    typeof p.year === "number"
  );
}

function comparePeriod(a: Period, b: Period) {
  const av = a.year * 100 + a.month;
  const bv = b.year * 100 + b.month;
  return { lt: av < bv, eq: av === bv, gt: av > bv };
}

