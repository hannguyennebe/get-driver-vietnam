"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type ExpenseInstance,
} from "@/lib/finance/apStore";
import type { PaymentTransaction, RecurringExpenseTemplate } from "@/lib/finance/apStore";
import {
  addManualExpenseFs,
  ensureRecurringExpensesForRangeFs,
  subscribeApExpenses,
  subscribeApPayments,
  subscribeApTemplates,
} from "@/lib/finance/apFirestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

export default function FinancePhaiTraPage() {
  const router = useRouter();
  const payBtnClass =
    "h-10 rounded-xl px-5 font-semibold text-white shadow-sm " +
    "bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] " +
    "hover:from-[#22B4EC] hover:to-[#0A6EA7] " +
    "active:from-[#169BCF] active:to-[#096596] disabled:opacity-60";
  const earthBtnClass =
    "h-9 text-zinc-900 shadow-sm " +
    "bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] " +
    "hover:from-[#EBCB7A] hover:to-[#B98A1F] " +
    "active:from-[#DDBA5D] active:to-[#A87912]";
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<ExpenseInstance[]>([]);
  const [paymentsByExpense, setPaymentsByExpense] = React.useState<Record<string, number>>({});
  const [templates, setTemplates] = React.useState<RecurringExpenseTemplate[]>([]);
  const [payments, setPayments] = React.useState<PaymentTransaction[]>([]);
  const [showCancelled, setShowCancelled] = React.useState(false);
  const [tab, setTab] = React.useState<"NOT_DUE" | "OVERDUE" | "PAID">("NOT_DUE");
  const [openAdd, setOpenAdd] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    amountVnd: "",
    accrualMonth: String(new Date().getMonth() + 1),
    accrualYear: String(new Date().getFullYear()),
    dueDateISO: todayIso(),
    note: "",
  });

  React.useEffect(() => {
    return () => {
      // no-op
    };
  }, []);

  React.useEffect(() => {
    const unsubT = subscribeApTemplates(setTemplates);
    const unsubE = subscribeApExpenses(setRows);
    const unsubP = subscribeApPayments(setPayments);
    return () => {
      unsubT();
      unsubE();
      unsubP();
    };
  }, []);

  React.useEffect(() => {
    const map: Record<string, number> = {};
    for (const p of payments) map[p.expenseId] = (map[p.expenseId] ?? 0) + (p.amountVnd || 0);
    setPaymentsByExpense(map);
  }, [payments]);

  React.useEffect(() => {
    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1;
    const from = shiftCalendarMonth(cy, cm, -1);
    const to = shiftCalendarMonth(cy, cm, 2);
    void ensureRecurringExpensesForRangeFs({
      fromYear: from.year,
      fromMonth: from.month,
      toYear: to.year,
      toMonth: to.month,
      templates,
      existingExpenses: rows,
    });
  }, [templates, rows]);

  const today = todayIso();

  const filtered = rows
    .filter((r) => (showCancelled ? true : r.status !== "Cancelled"))
    .filter((r) => {
      const hay = `${r.name} ${r.category} ${r.dueDateISO} ${r.accrualPeriod.month}/${r.accrualPeriod.year}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    })
    .sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO));

  const tabbed = React.useMemo(() => {
    const res = {
      NOT_DUE: [] as ExpenseInstance[],
      OVERDUE: [] as ExpenseInstance[],
      PAID: [] as ExpenseInstance[],
    };
    for (const r of filtered) {
      const paid = paymentsByExpense[r.id] ?? 0;
      const remaining = Math.max((r.amountVnd ?? 0) - paid, 0);
      const isPaid = r.status === "Paid" || remaining <= 0;
      if (isPaid) {
        res.PAID.push(r);
        continue;
      }
      const isOverdue = String(r.dueDateISO || "") < today;
      if (isOverdue) res.OVERDUE.push(r);
      else res.NOT_DUE.push(r);
    }
    // Keep consistent order inside each tab
    res.NOT_DUE.sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO));
    res.OVERDUE.sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO));
    res.PAID.sort((a, b) => b.dueDateISO.localeCompare(a.dueDateISO));
    return res;
  }, [filtered, paymentsByExpense, today]);

  const visible = tabbed[tab];

  return (
    <AppShell>
      <div className="px-6 pb-10">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Phải trả
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Danh sách nghĩa vụ chi theo kỳ (accrual) và hạn thanh toán.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                className={earthBtnClass}
                onClick={() => router.push("/finance/danh-muc-chi-van-phong")}
              >
                + Thêm danh mục
              </Button>
              <Button
                variant="secondary"
                className="h-9"
                onClick={() => {
                  setAddError(null);
                  setForm({
                    name: "",
                    amountVnd: "",
                    accrualMonth: String(new Date().getMonth() + 1),
                    accrualYear: String(new Date().getFullYear()),
                    dueDateISO: todayIso(),
                    note: "",
                  });
                  setOpenAdd(true);
                }}
              >
                + Thêm khoản phải trả
              </Button>
            </div>
          </div>

          <div className="mt-4 max-w-lg">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm kiếm..." />
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={showCancelled}
              onChange={(e) => setShowCancelled(e.target.checked)}
            />
            Hiện các kỳ đã huỷ (Cancelled)
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <TabBtn
              active={tab === "NOT_DUE"}
              onClick={() => setTab("NOT_DUE")}
              label={`Chưa quá hạn (${tabbed.NOT_DUE.length})`}
            />
            <TabBtn
              active={tab === "OVERDUE"}
              onClick={() => setTab("OVERDUE")}
              label={`Quá hạn (${tabbed.OVERDUE.length})`}
            />
            <TabBtn
              active={tab === "PAID"}
              onClick={() => setTab("PAID")}
              label={`Đã trả xong (${tabbed.PAID.length})`}
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2">Khoản chi</th>
                  <th className="px-3 py-2">Kỳ chi phí</th>
                  <th className="px-3 py-2">Hạn</th>
                  <th className="px-3 py-2 text-right">Số tiền</th>
                  <th className="px-3 py-2 text-right">Đã trả</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {visible.map((r) => {
                  const paid = paymentsByExpense[r.id] ?? 0;
                  const remaining = Math.max((r.amountVnd ?? 0) - paid, 0);
                  const disablePay = tab === "PAID" || r.status === "Paid" || remaining <= 0;
                  return (
                    <tr key={r.id} className="bg-white dark:bg-zinc-950">
                      <td className="px-3 py-3 font-medium">{r.name}</td>
                      <td className="px-3 py-3">
                        {String(r.accrualPeriod.month).padStart(2, "0")}/{r.accrualPeriod.year}
                      </td>
                      <td className="px-3 py-3">{isoToDmy(r.dueDateISO)}</td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                        {r.amountVnd.toLocaleString("vi-VN")} VND
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                        {paid > 0 ? `${paid.toLocaleString("vi-VN")} VND` : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          className={payBtnClass + " h-9 px-4"}
                          disabled={disablePay}
                          onClick={() => router.push(`/finance/thanh-toan?expenseId=${encodeURIComponent(r.id)}`)}
                        >
                          Thanh toán
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-zinc-500">
                      Chưa có dữ liệu.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm khoản phải trả</DialogTitle>
            <DialogDescription>
              Dùng cho các khoản phát sinh ngoài 3 khoản cố định hằng tháng.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Field label="Tên khoản chi">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Số tiền (VND)">
              <Input
                value={form.amountVnd}
                onChange={(e) => setForm({ ...form, amountVnd: e.target.value })}
                inputMode="numeric"
                placeholder="0"
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Kỳ chi phí (tháng)">
                <Input
                  value={form.accrualMonth}
                  onChange={(e) => setForm({ ...form, accrualMonth: e.target.value })}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Kỳ chi phí (năm)">
                <Input
                  value={form.accrualYear}
                  onChange={(e) => setForm({ ...form, accrualYear: e.target.value })}
                  inputMode="numeric"
                />
              </Field>
            </div>
            <Field label="Hạn thanh toán">
              <input
                type="date"
                value={form.dueDateISO}
                onChange={(e) => setForm({ ...form, dueDateISO: e.target.value })}
                className="gdvn-date h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
              />
            </Field>
            <Field label="Ghi chú">
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>

            {addError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {addError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                onClick={() => setOpenAdd(false)}
              >
                Huỷ
              </Button>
              <Button
                className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                onClick={() => {
                  setAddError(null);
                  if (!form.name.trim()) return setAddError("Vui lòng nhập tên khoản chi.");
                  const amount = Number(form.amountVnd.replace(/[^\d]/g, ""));
                  if (!Number.isFinite(amount) || amount <= 0) return setAddError("Số tiền không hợp lệ.");
                  const month = Number(form.accrualMonth);
                  const year = Number(form.accrualYear);
                  if (!Number.isFinite(month) || month < 1 || month > 12) return setAddError("Tháng không hợp lệ.");
                  if (!Number.isFinite(year) || year < 2000 || year > 2100) return setAddError("Năm không hợp lệ.");
                  if (!form.dueDateISO) return setAddError("Vui lòng chọn hạn thanh toán.");
                  void addManualExpenseFs({
                    name: form.name,
                    category: "OtherOffice",
                    amountVnd: amount,
                    accrualPeriod: { month, year },
                    dueDateISO: form.dueDateISO,
                    note: form.note.trim() || undefined,
                  });
                  setOpenAdd(false);
                }}
              >
                Lưu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: ExpenseInstance["status"] }) {
  const cls =
    status === "Paid"
      ? "bg-blue-100 text-blue-700"
      : status === "PartiallyPaid"
        ? "bg-amber-100 text-amber-800"
        : status === "Cancelled"
          ? "bg-zinc-200 text-zinc-700"
        : "bg-zinc-100 text-zinc-700";
  const label =
    status === "Paid"
      ? "Đã trả"
      : status === "PartiallyPaid"
        ? "Trả một phần"
        : status === "Cancelled"
          ? "Đã huỷ"
          : "Chưa trả";
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

function TabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-9 rounded-lg border px-3 text-sm",
        active
          ? "border-[#2E7AB0] bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
          : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function shiftCalendarMonth(year: number, month: number, delta: number) {
  let m = month + delta;
  let y = year;
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

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToDmy(iso: string) {
  const [y, m, d] = (iso ?? "").split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

