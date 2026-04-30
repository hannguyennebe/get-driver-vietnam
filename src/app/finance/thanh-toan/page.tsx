"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentConfirmDialog } from "@/components/finance/PaymentConfirmDialog";
import { addCashbookEntryFs } from "@/lib/finance/cashbookFirestore";
import { adjustDriverWalletBalanceFs } from "@/lib/fleet/driverWalletsFirestore";
import {
  type ExpenseInstance,
  type PaymentMethod,
  type PaymentTransaction,
} from "@/lib/finance/apStore";
import {
  addApPaymentFs,
  subscribeApExpenses,
  subscribeApPayments,
} from "@/lib/finance/apFirestore";
import { useSearchParams, useRouter } from "next/navigation";

export default function FinanceThanhToanPage() {
  return (
    <React.Suspense fallback={<Fallback />}>
      <FinanceThanhToanInner />
    </React.Suspense>
  );
}

function FinanceThanhToanInner() {
  const search = useSearchParams();
  const router = useRouter();
  const expenseId = search.get("expenseId") ?? "";

  const payBtnClass =
    "h-10 rounded-xl px-5 font-semibold text-white shadow-sm " +
    "bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] " +
    "hover:from-[#22B4EC] hover:to-[#0A6EA7] " +
    "active:from-[#169BCF] active:to-[#096596] disabled:opacity-60";

  const [expense, setExpense] = React.useState<ExpenseInstance | null>(null);
  const [payments, setPayments] = React.useState<PaymentTransaction[]>([]);
  const [choices, setChoices] = React.useState<ExpenseInstance[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    paidAtISO: todayIso(),
    amountVnd: "",
    reference: "",
  });
  const [openPay, setOpenPay] = React.useState(false);

  React.useEffect(() => {
    return () => {
      // no-op
    };
  }, [expenseId]);

  React.useEffect(() => {
    const unsubE = subscribeApExpenses((all) => {
      const active = all.filter((x) => x.status !== "Cancelled");
      setChoices(active.filter((x) => x.status !== "Paid"));
      setExpense(active.find((x) => x.id === expenseId) ?? null);
    });
    const unsubP = subscribeApPayments((all) =>
      setPayments(all.filter((p) => p.expenseId === expenseId)),
    );
    return () => {
      unsubE();
      unsubP();
    };
  }, [expenseId]);

  const paidTotal = payments.reduce((s, p) => s + (p.amountVnd || 0), 0);
  const remaining = Math.max((expense?.amountVnd ?? 0) - paidTotal, 0);

  return (
    <AppShell>
      <div className="px-6 pb-10">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Thanh toán
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Ghi nhận giao dịch tiền ra và cập nhật trạng thái phải trả.
              </p>
            </div>
            <Button variant="secondary" className="h-9" onClick={() => router.push("/finance/phai-tra")}>
              ← Quay lại
            </Button>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Thông tin khoản phải trả
              </div>
              <div className="mt-3">
                <label className="text-sm font-medium">Chọn khoản phải trả</label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                  value={expense?.id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    router.push(id ? `/finance/thanh-toan?expenseId=${encodeURIComponent(id)}` : "/finance/thanh-toan");
                  }}
                >
                  <option value="">—</option>
                  {choices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} • {String(c.accrualPeriod.month).padStart(2, "0")}/{c.accrualPeriod.year} • {c.amountVnd.toLocaleString("vi-VN")} VND
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 grid gap-3 text-sm">
                <Info label="Khoản chi" value={expense?.name ?? "—"} />
                <Info
                  label="Kỳ chi phí"
                  value={
                    expense
                      ? `${String(expense.accrualPeriod.month).padStart(2, "0")}/${expense.accrualPeriod.year}`
                      : "—"
                  }
                />
                <Info label="Hạn" value={expense ? isoToDmy(expense.dueDateISO) : "—"} />
                <Info
                  label="Số tiền"
                  value={expense ? `${expense.amountVnd.toLocaleString("vi-VN")} VND` : "—"}
                />
                <Info label="Đã trả" value={paidTotal > 0 ? `${paidTotal.toLocaleString("vi-VN")} VND` : "—"} />
                <Info label="Còn lại" value={`${remaining.toLocaleString("vi-VN")} VND`} strong />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Tạo giao dịch thanh toán
              </div>

              <div className="mt-4 space-y-3">
                <Field label="Ngày thanh toán">
                  <input
                    type="date"
                    value={form.paidAtISO}
                    onChange={(e) => setForm({ ...form, paidAtISO: e.target.value })}
                    className="gdvn-date h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </Field>
                <Field label="Số tiền (VND)">
                  <Input
                    value={form.amountVnd}
                    onChange={(e) => setForm({ ...form, amountVnd: e.target.value })}
                    inputMode="numeric"
                    placeholder={remaining.toString()}
                  />
                </Field>
                <Field label="Tham chiếu (tuỳ chọn)">
                  <Input
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    placeholder="Mã giao dịch / ghi chú..."
                  />
                </Field>

                {error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    className="h-9"
                    onClick={() => setForm({ ...form, amountVnd: remaining ? String(remaining) : "" })}
                    disabled={!expense}
                  >
                    Điền số còn lại
                  </Button>
                  <Button
                    className={payBtnClass + " h-9 px-4"}
                    onClick={() => {
                      setError(null);
                      if (!expense) return setError("Không tìm thấy khoản phải trả.");
                      if (expense.status === "Cancelled") return setError("Khoản này đã bị huỷ.");
                      const amount = Number(form.amountVnd.replace(/[^\d]/g, ""));
                      if (!Number.isFinite(amount) || amount <= 0) return setError("Số tiền không hợp lệ.");
                      if (amount > remaining) return setError("Số tiền vượt quá số còn lại.");
                      if (!form.paidAtISO) return setError("Vui lòng chọn ngày thanh toán.");
                      setOpenPay(true);
                    }}
                    disabled={!expense}
                  >
                    Thanh toán
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="px-5 py-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Lịch sử thanh toán
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2">Ngày</th>
                  <th className="px-3 py-2 text-right">Số tiền</th>
                  <th className="px-3 py-2">Hình thức</th>
                  <th className="px-3 py-2">Tham chiếu</th>
                  <th className="px-3 py-2">Người tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {payments
                  .slice()
                  .sort((a, b) => b.paidAtISO.localeCompare(a.paidAtISO))
                  .map((p) => (
                    <tr key={p.id} className="bg-white dark:bg-zinc-950">
                      <td className="px-3 py-3">{isoToDmy(p.paidAtISO)}</td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                        {p.amountVnd.toLocaleString("vi-VN")} VND
                      </td>
                      <td className="px-3 py-3">{p.method}</td>
                      <td className="px-3 py-3">{p.reference ?? "—"}</td>
                      <td className="px-3 py-3">{p.createdBy}</td>
                    </tr>
                  ))}

                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">
                      Chưa có thanh toán.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PaymentConfirmDialog
        open={openPay}
        onOpenChange={setOpenPay}
        title="Thanh toán chi"
        description="Bước 1: chọn nguồn tiền. Bước 2: chọn loại tiền và nhập số tiền."
        defaultCurrency="VND"
        lockCurrencyTo="VND"
        defaultAmount={Number(form.amountVnd.replace(/[^\d]/g, "")) || undefined}
        onConfirm={(r) => {
          setError(null);
          if (!expense) return setError("Không tìm thấy khoản phải trả.");
          if (expense.status === "Cancelled") return setError("Khoản này đã bị huỷ.");
          const amountVnd = Math.round(r.amount);
          if (!amountVnd || amountVnd <= 0) return setError("Số tiền không hợp lệ.");
          if (amountVnd > remaining) return setError("Số tiền vượt quá số còn lại.");
          if (!form.paidAtISO) return setError("Vui lòng chọn ngày thanh toán.");

          // AP payment transaction
          void addApPaymentFs({
            expenseId: expense.id,
            paidAtISO: form.paidAtISO,
            amountVnd,
            method: methodFromSourceId(r.sourceId),
            reference: form.reference,
          });

          // Cashbook entry: chi tiền từ nguồn đã chọn
          void addCashbookEntryFs({
            direction: "OUT",
            sourceId: r.sourceId,
            currency: "VND",
            amount: amountVnd,
            method: methodFromSourceId(r.sourceId),
            content: `Chi • ${expense.name} • ${String(expense.accrualPeriod.month).padStart(2, "0")}/${expense.accrualPeriod.year}`,
            referenceType: "AP",
            referenceId: expense.id,
          });

          // If wallet source: reduce wallet balance
          if (r.sourceId.startsWith("WALLET:")) {
            const walletKey = r.sourceId.slice("WALLET:".length);
            void adjustDriverWalletBalanceFs(walletKey, "VND", -amountVnd);
          }
          setForm({ paidAtISO: todayIso(), amountVnd: "", reference: "" });
        }}
      />
    </AppShell>
  );
}

function methodFromSourceId(sourceId: string): PaymentMethod {
  if (sourceId === "CASH") return "TM";
  return "CK";
}

function Fallback() {
  return (
    <AppShell>
      <div className="px-6 pb-10">
        <div className="pt-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            Đang tải...
          </div>
        </div>
      </div>
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

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-zinc-600 dark:text-zinc-300">{label}</div>
      <div className={strong ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-900 dark:text-zinc-50"}>
        {value}
      </div>
    </div>
  );
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

