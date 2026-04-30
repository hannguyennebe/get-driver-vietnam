import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { getCurrentUserIdentity } from "@/lib/auth/currentUser";
import type {
  ExpenseInstance,
  PaymentTransaction,
  RecurringExpenseTemplate,
} from "@/lib/finance/apStore";
import { dueDateISOForTemplateAccrual } from "@/lib/finance/apStore";

const COL_TPL = "ap_templates";
const COL_EXP = "ap_expenses";
const COL_PAY = "ap_payments";

function stripUndefined<T>(obj: T): T {
  // Firestore rejects `undefined` field values. This removes them recursively.
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

export function subscribeApTemplates(onRows: (rows: RecurringExpenseTemplate[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL_TPL), orderBy("updatedAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: RecurringExpenseTemplate[] = [];
      snap.forEach((d) => rows.push(d.data() as RecurringExpenseTemplate));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function upsertApTemplateFs(tpl: RecurringExpenseTemplate) {
  const db = getFirebaseDb();
  const id = String(tpl.id || "").trim();
  if (!id) throw new Error("missing_id");
  await setDoc(doc(db, COL_TPL, id), stripUndefined(tpl), { merge: false });
}

export function subscribeApExpenses(onRows: (rows: ExpenseInstance[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL_EXP), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: ExpenseInstance[] = [];
      snap.forEach((d) => rows.push(d.data() as ExpenseInstance));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export function subscribeApPayments(onRows: (rows: PaymentTransaction[]) => void): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(collection(db, COL_PAY), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows: PaymentTransaction[] = [];
      snap.forEach((d) => rows.push(d.data() as PaymentTransaction));
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function upsertApExpenseFs(expense: ExpenseInstance) {
  const db = getFirebaseDb();
  const id = String(expense.id || "").trim();
  if (!id) throw new Error("missing_id");
  await setDoc(doc(db, COL_EXP, id), stripUndefined(expense), { merge: false });
}

export async function addManualExpenseFs(input: {
  name: string;
  category: string;
  amountVnd: number;
  accrualPeriod: ExpenseInstance["accrualPeriod"];
  dueDateISO: string;
  note?: string;
}) {
  const db = getFirebaseDb();
  const me = getCurrentUserIdentity();
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
    createdBy: me?.name ?? "—",
  };
  await setDoc(doc(db, COL_EXP, expense.id), stripUndefined(expense), { merge: false });
  return expense;
}

export async function addApPaymentFs(input: {
  expenseId: string;
  paidAtISO: string;
  amountVnd: number;
  method: PaymentTransaction["method"];
  reference?: string;
}) {
  const db = getFirebaseDb();
  const me = getCurrentUserIdentity();
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
    createdBy: me?.name ?? "—",
  };

  const expRef = doc(db, COL_EXP, String(input.expenseId));
  const payRef = doc(db, COL_PAY, payment.id);

  await runTransaction(db, async (tx) => {
    const expSnap = await tx.get(expRef);
    if (!expSnap.exists()) throw new Error("expense_not_found");
    const exp = expSnap.data() as ExpenseInstance;
    if (exp.status === "Cancelled") throw new Error("expense_cancelled");

    // Create payment first
    tx.set(payRef, payment, { merge: false });

    const currPaid = Number((expSnap.data() as any)?.paidVnd ?? 0) || 0;
    const nextPaid = currPaid + (Number(payment.amountVnd ?? 0) || 0);
    const total = Number(exp.amountVnd ?? 0) || 0;
    const status =
      nextPaid <= 0 ? ("Unpaid" as const) : nextPaid >= total ? ("Paid" as const) : ("PartiallyPaid" as const);
    tx.set(expRef, { paidVnd: nextPaid, status } as any, { merge: true });
  });

  return payment;
}

export async function ensureRecurringExpensesForRangeFs(input: {
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  templates: RecurringExpenseTemplate[];
  existingExpenses: ExpenseInstance[];
}) {
  const db = getFirebaseDb();
  const me = getCurrentUserIdentity();
  const existsKey = new Set(
    input.existingExpenses
      .filter((e) => e.templateId)
      .map((e) => `${e.templateId}:${e.accrualPeriod.year}-${e.accrualPeriod.month}`),
  );

  const months = enumerateMonths(input.fromYear, input.fromMonth, input.toYear, input.toMonth);
  const now = Date.now();

  const writes: Array<Promise<unknown>> = [];
  for (const m of months) {
    for (const tpl of input.templates) {
      if (!tpl.active) continue;
      const accrual = addMonths(m.year, m.month, tpl.accrualMonthOffset);
      if (comparePeriod(accrual, tpl.startPeriod).lt) continue;
      if (tpl.endPeriod && comparePeriod(accrual, tpl.endPeriod).gt) continue;
      if (tpl.finalizedEffectiveTo && comparePeriod(accrual, tpl.finalizedEffectiveTo).gt) continue;
      const key = `${tpl.id}:${accrual.year}-${accrual.month}`;
      if (existsKey.has(key)) continue;

      const dueDateISO = dueDateISOForTemplateAccrual(accrual, tpl);
      const exp: ExpenseInstance = {
        id: `EXP-${tpl.id}-${accrual.year}-${String(accrual.month).padStart(2, "0")}`,
        templateId: tpl.id,
        name: tpl.name,
        category: tpl.name,
        amountVnd: tpl.defaultAmountVnd ?? 0,
        currency: tpl.currency,
        accrualPeriod: accrual,
        dueDateISO,
        status: "Unpaid",
        createdAt: now,
        createdBy: me?.name ?? "—",
      };
      existsKey.add(key);
      writes.push(setDoc(doc(db, COL_EXP, exp.id), stripUndefined(exp), { merge: false }));
    }
  }

  if (writes.length) await Promise.all(writes);
}

export async function finalizeApTemplateEarlyFs(input: {
  templateId: string;
  effectiveTo: { month: number; year: number };
  templates: RecurringExpenseTemplate[];
  existingExpenses: ExpenseInstance[];
}) {
  const db = getFirebaseDb();
  const me = getCurrentUserIdentity();
  const tpl = input.templates.find((t) => t.id === input.templateId);
  if (!tpl) throw new Error("not_found");

  const nextTpl: RecurringExpenseTemplate = {
    ...tpl,
    finalizedAt: Date.now(),
    finalizedBy: me?.name ?? "—",
    finalizedEffectiveTo: input.effectiveTo as any,
    active: false,
    updatedAt: Date.now(),
  };

  const writes: Array<Promise<unknown>> = [];
  writes.push(setDoc(doc(db, COL_TPL, nextTpl.id), nextTpl, { merge: false }));

  for (const e of input.existingExpenses) {
    if (e.templateId !== input.templateId) continue;
    if (!comparePeriod(e.accrualPeriod, input.effectiveTo).gt) continue;
    if (e.status === "Paid") continue;
    writes.push(setDoc(doc(db, COL_EXP, e.id), { status: "Cancelled" } as any, { merge: true }));
  }
  await Promise.all(writes);
  return nextTpl;
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

function comparePeriod(a: { year: number; month: number }, b: { year: number; month: number }) {
  const av = a.year * 100 + a.month;
  const bv = b.year * 100 + b.month;
  return { lt: av < bv, eq: av === bv, gt: av > bv };
}

