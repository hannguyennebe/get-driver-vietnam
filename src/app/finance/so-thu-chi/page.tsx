"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getPaymentInfo, type PaymentAccount, type PaymentInfo } from "@/lib/admin/paymentStore";
import {
  computeBalance,
  ensureCashbookStore,
  listCashbookEntries,
  type CashbookEntry,
  type CashbookSourceId,
} from "@/lib/finance/cashbookStore";
import { type Reservation } from "@/lib/reservations/reservationStore";
import { subscribeActiveReservations } from "@/lib/reservations/reservationsFirestore";
import { ensureApStore, listExpenses, listPayments } from "@/lib/finance/apStore";
import { ensurePartnersStore, getPartners } from "@/lib/data/partnersStore";
import {
  ensureOperatingExpensesStore,
  listOperatingExpenses,
} from "@/lib/finance/operatingExpensesStore";
import { ensureOtherExpensesStore, listOtherExpenses } from "@/lib/finance/otherExpensesStore";
import {
  ensureDriverAdvancesStore,
  listDriverAdvances,
} from "@/lib/finance/driverAdvancesStore";

type CashflowType = "Thu" | "Chi";

type CashflowRow = {
  id: string;
  type: CashflowType;
  date: string; // dd/mm/yyyy
  time: string; // HH:mm
  content: string;
  amount: number;
  currency: string;
  source: string;
};

export default function FinanceSoThuChiPage() {
  const [q, setQ] = React.useState("");
  const [tab, setTab] = React.useState<CashflowType>("Thu");
  const [rows, setRows] = React.useState<CashflowRow[]>([]);
  const [paymentInfo, setPaymentInfo] = React.useState<PaymentInfo | null>(null);
  const [monthSel, setMonthSel] = React.useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [expenseSel, setExpenseSel] = React.useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [balances, setBalances] = React.useState({
    cash: {} as Record<string, number>,
    vatVnd: 0,
    noVatVnd: 0,
    usd: 0,
  });
  const [cashflowBoxes, setCashflowBoxes] = React.useState({
    actualVnd: 0,
    expectedVnd: 0,
  });
  const [reservations, setReservations] = React.useState<Reservation[]>([]);

  const load = React.useCallback(() => {
    ensureCashbookStore();
    const pi = getPaymentInfo();
    setPaymentInfo(pi);

    const entries = listCashbookEntries();
    const cash: Record<string, number> = {};
    for (const e of entries) {
      if (e.sourceId !== "CASH") continue;
      const cur = String(e.currency || "VND").trim().toUpperCase() || "VND";
      const signed = e.direction === "IN" ? e.amount : -e.amount;
      cash[cur] = (cash[cur] ?? 0) + signed;
    }

    setBalances({
      cash,
      vatVnd: computeBalance({ sourceId: "VAT_VND", currency: "VND" }),
      noVatVnd: computeBalance({ sourceId: "NOVAT_VND", currency: "VND" }),
      usd: computeBalance({ sourceId: "USD", currency: "USD" }),
    });

    // Cashflow summary blocks (VND)
    ensureApStore();
    ensurePartnersStore();
    ensureOperatingExpensesStore();
    ensureOtherExpensesStore();
    ensureDriverAdvancesStore();
    const today = toIsoDate(new Date()); // realtime (local timezone)

    const cashVnd = Number(cash["VND"] ?? 0) || 0;
    const fundVnd = cashVnd + computeBalance({ sourceId: "VAT_VND", currency: "VND" }) + computeBalance({ sourceId: "NOVAT_VND", currency: "VND" });

    const expenses = listExpenses();
    const payments = listPayments();
    const paidByExpense = new Map<string, number>();
    for (const p of payments) {
      paidByExpense.set(p.expenseId, (paidByExpense.get(p.expenseId) ?? 0) + (p.amountVnd || 0));
    }
    const unpaid = expenses.filter((e) => e.status !== "Paid" && e.status !== "Cancelled");
    const remaining = (e: any) => Math.max(0, (e.amountVnd || 0) - (paidByExpense.get(e.id) ?? 0));
    // Total payables due by realtime date (overdue + due today)
    const duePayablesVnd = unpaid
      .filter((e) => (e.dueDateISO || "") <= today)
      .reduce((s, e) => s + remaining(e), 0);
    const allPayablesVnd = unpaid.reduce((s, e) => s + remaining(e), 0);

    const partners = getPartners();
    const taById = new Map(partners.travelAgents.map((t) => [t.id, t] as const));

    const dueReceivablesVnd = reservations
      .filter((r) => r.currency === "VND" && r.paymentType !== "Ví tài xế")
      .filter((r) => {
        const due = reservationDueIso(r, taById);
        return due ? due <= today : false;
      })
      .reduce((s, r) => s + (r.amount || 0), 0);

    setCashflowBoxes({
      actualVnd: fundVnd - duePayablesVnd,
      expectedVnd: fundVnd + dueReceivablesVnd - duePayablesVnd,
    });

    const out: CashflowRow[] = entries.map((e) => ({
      id: e.id,
      type: e.direction === "IN" ? "Thu" : "Chi",
      date: e.createdDate,
      time: e.createdTime,
      content: e.content,
      amount: e.amount,
      currency: String(e.currency || "VND").trim().toUpperCase() || "VND",
      source: sourceLabel(e.sourceId, pi),
    }));
    out.sort((a, b) => tripKey(b.date, b.time) - tripKey(a.date, a.time));
    setRows(out);
  }, [reservations]);

  React.useEffect(() => {
    load();
    const unsub = subscribeActiveReservations(setReservations);
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (
        e.key.includes("getdriver.finance.cashbook") ||
        e.key.includes("getdriver.payment.info")
      ) {
        load();
      }
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      unsub();
    };
  }, [load]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => r.type === tab)
      .filter((r) => {
        if (!needle) return true;
        const hay = `${r.content} ${r.source} ${r.date} ${r.time}`.toLowerCase();
        return hay.includes(needle);
      });
  }, [rows, tab, q]);

  const sum = React.useMemo(
    () => filtered.reduce((s, r) => s + (r.currency === "VND" ? (r.amount || 0) : 0), 0),
    [filtered],
  );

  const monthSummary = React.useMemo(() => {
    const y = monthSel.year;
    const m = monthSel.month;
    const key = `${String(m).padStart(2, "0")}/${y}`;
    const inVnd = rows
      .filter((r) => r.currency === "VND")
      .filter((r) => (r.date || "").endsWith(key))
      .filter((r) => r.type === "Thu")
      .reduce((s, r) => s + (r.amount || 0), 0);
    const outVnd = rows
      .filter((r) => r.currency === "VND")
      .filter((r) => (r.date || "").endsWith(key))
      .filter((r) => r.type === "Chi")
      .reduce((s, r) => s + (r.amount || 0), 0);
    return { inVnd, outVnd };
  }, [rows, monthSel.year, monthSel.month]);

  return (
    <AppShell>
      <div className="flex-1 px-6 pb-10">
        <div className="pt-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Sổ thu chi</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Nhật ký thu/chi theo giao dịch đã thực hiện (thực tế).
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TopAccountCard
              title="Tiền Mặt"
              meta={[
                { label: "Loại Tiền", value: listCurrencies(balances.cash) },
                {
                  label: "Số dư",
                  value: formatBalances(balances.cash),
                },
              ]}
            />
            <TopAccountCard
              title="Tài khoản VAT - VND"
              meta={[
                { label: "Tên Ngân Hàng", value: paymentInfo?.vatVnd.bankName ?? "—" },
                { label: "Số TK", value: paymentInfo?.vatVnd.accountNumber ?? "—" },
                { label: "Loại Tiền", value: "VND" },
                { label: "Chủ Tài Khoản", value: paymentInfo?.vatVnd.accountHolder ?? "—" },
                {
                  label: "Số dư",
                  value: `${balances.vatVnd.toLocaleString("vi-VN")} VND`,
                },
              ]}
            />
            <TopAccountCard
              title="Tài khoản No VAT - VND"
              meta={[
                { label: "Tên Ngân Hàng", value: paymentInfo?.noVatVnd.bankName ?? "—" },
                { label: "Số TK", value: paymentInfo?.noVatVnd.accountNumber ?? "—" },
                { label: "Loại Tiền", value: "VND" },
                { label: "Chủ Tài Khoản", value: paymentInfo?.noVatVnd.accountHolder ?? "—" },
                {
                  label: "Số dư",
                  value: `${balances.noVatVnd.toLocaleString("vi-VN")} VND`,
                },
              ]}
            />
            <TopAccountCard
              title="Tài khoản USD"
              meta={[
                { label: "Tên Ngân Hàng", value: paymentInfo?.usd.bankName ?? "—" },
                { label: "Số TK", value: paymentInfo?.usd.accountNumber ?? "—" },
                { label: "Loại Tiền", value: "USD" },
                { label: "Chủ Tài Khoản", value: paymentInfo?.usd.accountHolder ?? "—" },
                {
                  label: "Số dư",
                  value: `${balances.usd.toLocaleString("en-US")} USD`,
                },
              ]}
            />
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Sổ thu chi chỉ ghi nhận khi có thao tác <b>Thanh Toán</b>/<b>Xác nhận</b> (chọn nguồn tiền, số tiền).
            Các dữ liệu booking/phải thu/phải trả chỉ là nghĩa vụ, không tự động vào sổ.
          </div>

          <div className="mt-4 space-y-3">
            <CashflowSummaryCard
              tone="actual"
              title="Dòng tiền thực tế"
              subtitle="Quỹ (VND) - Tổng khoản chi đến hạn"
              valueVnd={cashflowBoxes.actualVnd}
            />
            <CashflowSummaryCard
              tone="expected"
              title="Dòng tiền dự kiến"
              subtitle="Quỹ (VND) + Khoản thu đến hạn + Công nợ đến hạn - Khoản chi đến hạn"
              valueVnd={cashflowBoxes.expectedVnd}
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <MonthKpiCard
              title="Doanh thu"
              value={formatCompactVnd(monthSummary.inVnd)}
              subtitle={`Theo kỳ thực hiện (${String(monthSel.month).padStart(2, "0")}/${monthSel.year})`}
              month={monthSel.month}
              year={monthSel.year}
              onMonthChange={(month) => setMonthSel((s) => ({ ...s, month }))}
              onYearChange={(year) => setMonthSel((s) => ({ ...s, year }))}
              icon={<span className="text-[#0B79B8]">↗</span>}
            />
            <MonthKpiCard
              title="Chi phí"
              value={formatCompactVnd(monthSummary.outVnd)}
              subtitle={`Phát sinh + đến hạn trong tháng (${String(monthSel.month).padStart(2, "0")}/${monthSel.year})`}
              month={monthSel.month}
              year={monthSel.year}
              onMonthChange={(month) => setMonthSel((s) => ({ ...s, month }))}
              onYearChange={(year) => setMonthSel((s) => ({ ...s, year }))}
              icon={<span className="text-[#0B79B8]">↘</span>}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <MonthlyInOutChart rows={rows} />
            <ExpenseDonutCard
              reservations={reservations}
              year={expenseSel.year}
              month={expenseSel.month}
              onYearChange={(year) => setExpenseSel((s) => ({ ...s, year }))}
              onMonthChange={(month) => setExpenseSel((s) => ({ ...s, month }))}
            />
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="w-full max-w-md">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm theo nội dung, ngày, nguồn..."
              />
            </div>
            <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <Button
                type="button"
                variant="secondary"
                className={`h-9 rounded-md px-4 ${
                  tab === "Thu" ? "bg-zinc-100 dark:bg-zinc-900" : ""
                }`}
                onClick={() => setTab("Thu")}
              >
                Thu
              </Button>
              <Button
                type="button"
                variant="secondary"
                className={`h-9 rounded-md px-4 ${
                  tab === "Chi" ? "bg-zinc-100 dark:bg-zinc-900" : ""
                }`}
                onClick={() => setTab("Chi")}
              >
                Chi
              </Button>
            </div>
          </div>

          <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
            Tổng {tab.toLowerCase()}:{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {sum.toLocaleString("vi-VN")} VND
            </span>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2">Ngày</th>
                  <th className="whitespace-nowrap px-3 py-2">Giờ</th>
                  <th className="px-3 py-2">Nội dung</th>
                  <th className="px-3 py-2">Nguồn</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {filtered.map((r) => (
                  <tr key={r.id} className="bg-white dark:bg-zinc-950">
                    <td className="whitespace-nowrap px-3 py-2.5">{r.date}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{r.time}</td>
                    <td className="px-3 py-2.5">{r.content || "—"}</td>
                    <td className="px-3 py-2.5 text-zinc-500 dark:text-zinc-400">{r.source}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums font-medium">
                      {formatAmount(r.amount, r.currency)}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">
                      Chưa có dữ liệu.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function sourceLabel(sourceId: CashbookSourceId, paymentInfo: PaymentInfo) {
  if (sourceId === "CASH") return "Tiền Mặt";
  if (sourceId === "VAT_VND") return `VAT - ${paymentInfo.vatVnd.bankName}`;
  if (sourceId === "NOVAT_VND") return `No VAT - ${paymentInfo.noVatVnd.bankName}`;
  if (sourceId === "USD") return `USD - ${paymentInfo.usd.bankName}`;
  if (String(sourceId).startsWith("WALLET:")) return `Ví tài xế • ${String(sourceId).slice("WALLET:".length)}`;
  return String(sourceId);
}

function tripKey(dateDmy: string, timeHm: string) {
  const [dd, mm, yyyy] = (dateDmy ?? "").split("/").map((x) => Number(x));
  const [hh, mi] = (timeHm ?? "").split(":").map((x) => Number(x));
  const y = Number.isFinite(yyyy) ? yyyy : 0;
  const m = Number.isFinite(mm) ? mm : 0;
  const d = Number.isFinite(dd) ? dd : 0;
  const h = Number.isFinite(hh) ? hh : 0;
  const n = Number.isFinite(mi) ? mi : 0;
  return (((y * 100 + m) * 100 + d) * 100 + h) * 100 + n;
}

function formatBalances(balances: Record<string, number> | undefined) {
  const b = balances ?? {};
  const rows: Array<{ cur: string; amt: number }> = [];
  rows.push({ cur: "VND", amt: Number(b["VND"] ?? 0) || 0 });
  for (const [curRaw, amtRaw] of Object.entries(b)) {
    const cur = String(curRaw || "").trim().toUpperCase();
    if (!cur || cur === "VND") continue;
    const amt = Number(amtRaw ?? 0) || 0;
    rows.push({ cur, amt });
  }
  return rows
    .map((x) =>
      x.cur === "VND"
        ? `${x.amt.toLocaleString("vi-VN")} VND`
        : `${x.amt.toLocaleString("en-US")} ${x.cur}`,
    )
    .join(" • ");
}

function formatAmount(amount: number, currency: string) {
  const cur = String(currency || "VND").trim().toUpperCase() || "VND";
  const n = Number(amount ?? 0) || 0;
  if (cur === "VND") return `${n.toLocaleString("vi-VN")} VND`;
  return `${n.toLocaleString("en-US")} ${cur}`;
}

function listCurrencies(balances: Record<string, number> | undefined) {
  const b = balances ?? {};
  const set = new Set<string>();
  set.add("VND");
  for (const k of Object.keys(b)) {
    const cur = String(k || "").trim().toUpperCase();
    if (cur) set.add(cur);
  }
  return Array.from(set.values()).join(", ");
}

function TopAccountCard({
  title,
  meta,
}: {
  title: string;
  meta: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</div>
      <div className="mt-3 grid gap-2 text-xs">
        {meta.map((m) => (
          <div key={m.label} className="flex items-center justify-between gap-3">
            <div className="text-zinc-500 dark:text-zinc-400">{m.label}</div>
            <div className="max-w-[70%] truncate text-right font-medium text-zinc-900 dark:text-zinc-50">
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashflowSummaryCard({
  tone,
  title,
  subtitle,
  valueVnd,
}: {
  tone: "actual" | "expected";
  title: string;
  subtitle: string;
  valueVnd: number;
}) {
  const actual = tone === "actual";
  const expected = tone === "expected";

  const blink = actual
    ? valueVnd < 0
      ? "animate-pulse border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
      : valueVnd < 5_000_000
        ? "animate-pulse border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
        : "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30"
    : expected
      ? valueVnd < 0
        ? "animate-pulse border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
        : "animate-pulse border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";

  const valueTone = valueVnd < 0 ? "text-red-700 dark:text-red-200" : "text-zinc-900 dark:text-zinc-50";
  return (
    <div className={`rounded-xl border px-4 py-3 ${blink}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</div>
        </div>
        <div className={`shrink-0 text-sm font-semibold tabular-nums ${valueTone}`}>
          {Math.round(valueVnd).toLocaleString("vi-VN")} VND
        </div>
      </div>
    </div>
  );
}

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatCompactVnd(n: number) {
  const v = Math.round(Number(n ?? 0) || 0);
  if (Math.abs(v) >= 1_000_000_000) return `${Math.round(v / 1_000_000_000)}B`;
  if (Math.abs(v) >= 1_000_000) return `${Math.round(v / 1_000_000)}M`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}K`;
  return String(v);
}

function MonthKpiCard({
  title,
  value,
  subtitle,
  month,
  year,
  onMonthChange,
  onYearChange,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  month: number;
  year: number;
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
  icon: React.ReactNode;
}) {
  const years = React.useMemo(() => {
    const now = new Date().getFullYear();
    return [now - 1, now, now + 1];
  }, []);
  const months = React.useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">{title}</div>
          <div className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            {value}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex flex-col items-end gap-2">
            <select
              className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950"
              value={year}
              onChange={(e) => onYearChange(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950"
              value={month}
              onChange={(e) => onMonthChange(Number(e.target.value))}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-lg dark:bg-zinc-900">
            {icon}
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</div>
    </div>
  );
}

function MonthlyInOutChart({ rows }: { rows: CashflowRow[] }) {
  const now = new Date();
  const cur = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const months = React.useMemo(() => {
    const list: Array<{ year: number; month: number; kind: "PAST" | "NOW" | "FUTURE" }> = [];
    for (let i = -2; i <= 2; i++) {
      const { year, month } = addMonths(cur.year, cur.month, i);
      list.push({ year, month, kind: i < 0 ? "PAST" : i === 0 ? "NOW" : "FUTURE" });
    }
    return list;
  }, [cur.year, cur.month]);

  const series = React.useMemo(() => {
    const byKey = new Map<string, { inVnd: number; outVnd: number }>();
    for (const m of months) {
      byKey.set(monthKey(m.year, m.month), { inVnd: 0, outVnd: 0 });
    }
    for (const r of rows) {
      if (r.currency !== "VND") continue;
      const mk = dmyMonthKey(r.date);
      const bucket = byKey.get(mk);
      if (!bucket) continue;
      if (r.type === "Thu") bucket.inVnd += r.amount || 0;
      else bucket.outVnd += r.amount || 0;
    }
    const out = months.map((m) => {
      const k = monthKey(m.year, m.month);
      const v = byKey.get(k) ?? { inVnd: 0, outVnd: 0 };
      return { ...m, ...v, key: k };
    });
    const max = out.reduce((mx, x) => Math.max(mx, x.inVnd, x.outVnd), 0);
    return { out, max: max > 0 ? max : 1 };
  }, [rows, months]);

  const bar = (value: number) => Math.max(0, Math.min(1, value / series.max));

  const pastFill = "#C79A2B"; // earth
  const nowFill = "#0B79B8"; // blue
  const futureFill = "#E5E7EB"; // gray

  const inTint = (kind: "PAST" | "NOW" | "FUTURE") =>
    kind === "PAST" ? pastFill : kind === "NOW" ? nowFill : futureFill;
  const outTint = (kind: "PAST" | "NOW" | "FUTURE") =>
    kind === "PAST" ? "#E6C36A" : kind === "NOW" ? "#1AAAE1" : "#F3F4F6";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Thu - Chi theo 5 tháng
      </div>
      <div className="mt-4">
        <div className="flex items-end justify-between gap-4">
          {series.out.map((m) => (
            <div key={m.key} className="flex w-full flex-col items-center gap-2">
              <div className="flex h-44 w-full max-w-[120px] items-end justify-center gap-2">
                <div
                  className="w-5 rounded-t"
                  style={{
                    height: `${Math.round(160 * bar(m.inVnd))}px`,
                    background: inTint(m.kind),
                  }}
                  title={`Doanh thu: ${Math.round(m.inVnd).toLocaleString("vi-VN")} VND`}
                />
                <div
                  className="w-5 rounded-t"
                  style={{
                    height: `${Math.round(160 * bar(m.outVnd))}px`,
                    background: outTint(m.kind),
                  }}
                  title={`Chi phí: ${Math.round(m.outVnd).toLocaleString("vi-VN")} VND`}
                />
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                T{m.month}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-6 text-xs text-zinc-600 dark:text-zinc-300">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: nowFill }} />
            Doanh thu
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#1AAAE1" }} />
            Chi phí
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpenseDonutCard({
  reservations,
  year,
  month,
  onMonthChange,
  onYearChange,
}: {
  reservations: Reservation[];
  year: number;
  month: number;
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
}) {
  const years = React.useMemo(() => {
    const now = new Date().getFullYear();
    return [now - 1, now, now + 1];
  }, []);
  const months = React.useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const data = React.useMemo(() => {
    const mk = monthKey(year, month);

    // 1) Chi gọi xe ngoài: tổng giá thuê ngoài theo tháng ngày đi (khoản phải thanh toán + công nợ phải thanh toán)
    const extHireVnd = reservations
      .filter((r) => dmyMonthKey(r.date) === mk)
      .reduce((s, r) => s + (Number(r.assignedExternalPriceVnd ?? 0) || 0), 0);

    // 2) Chi vận hành
    const ops = listOperatingExpenses().filter((o) => dmyMonthKey(o.createdDate) === mk);
    const vetcVnd = ops.filter((o) => o.type === "VETC").reduce((s, o) => s + (o.amountVnd || 0), 0);
    const fuelVnd = ops.filter((o) => o.type === "Nhiên Liệu").reduce((s, o) => s + (o.amountVnd || 0), 0);
    const serviceVnd = ops
      .filter((o) => o.type === "Bảo Dưỡng" || o.type === "Thay Dầu")
      .reduce((s, o) => s + (o.amountVnd || 0), 0);

    // 3) Chi lương lái xe (hiện lấy theo các khoản tạm ứng đã thanh toán)
    const payrollVnd = listDriverAdvances()
      .filter((a) => dmyMonthKey(a.createdDate) === mk)
      .reduce((s, a) => s + (a.amountVnd || 0), 0);

    // 4) Chi phí văn phòng (AP templates office)
    const expenses = listExpenses();
    const payments = listPayments();
    const paidByExpense = new Map<string, number>();
    for (const p of payments) {
      paidByExpense.set(p.expenseId, (paidByExpense.get(p.expenseId) ?? 0) + (p.amountVnd || 0));
    }
    const remaining = (e: any) => Math.max(0, (e.amountVnd || 0) - (paidByExpense.get(e.id) ?? 0));
    const officeVnd = expenses
      .filter((e) => isoMonthKey(e.dueDateISO) === mk)
      .filter((e) => String(e.templateId || "").startsWith("TPL-OFFICE"))
      .reduce((s, e) => s + remaining(e), 0);

    // 5) Chi khác (OtherExpense)
    const otherVnd = listOtherExpenses()
      .filter((o) => o.currency === "VND")
      .filter((o) => dmyMonthKey(o.createdDate) === mk)
      .reduce((s, o) => s + (o.amount || 0), 0);

    const items = [
      { label: "Chi gọi xe ngoài", value: extHireVnd, color: "#F97316" },
      { label: "Chi VETC", value: vetcVnd, color: "#0B79B8" },
      { label: "Chi Nhiên Liệu", value: fuelVnd, color: "#E6C36A" },
      { label: "Chi Bảo Dưỡng + Thay Dầu", value: serviceVnd, color: "#8B5CF6" },
      { label: "Chi Lương Lái Xe", value: payrollVnd, color: "#22C55E" },
      { label: "Chi Phí Văn Phòng", value: officeVnd, color: "#64748B" },
      { label: "Các Khoản Chi Khác", value: otherVnd, color: "#EF4444" },
    ].filter((x) => x.value > 0);

    const total = items.reduce((s, x) => s + x.value, 0);
    return { items, total };
  }, [reservations, year, month]);

  const size = 120;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Phân tích chi phí
        </div>
        <div className="flex flex-col items-end gap-2">
          <select
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950"
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950"
            value={month}
            onChange={(e) => onMonthChange(Number(e.target.value))}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-5">
        <div className="relative h-[120px] w-[120px] shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="#E5E7EB"
              strokeWidth={stroke}
              fill="none"
            />
            {data.items.map((s, idx) => {
              const pct = data.total <= 0 ? 0 : s.value / data.total;
              const dash = c * pct;
              const dashArray = `${dash} ${c - dash}`;
              const dashOffset = c * (1 - offset);
              offset += pct;
              return (
                <circle
                  key={idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={s.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeLinecap="butt"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-xs text-zinc-600">Tổng</div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {Math.round(data.total).toLocaleString("vi-VN")}
            </div>
            <div className="text-[10px] text-zinc-500">VND</div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2 text-xs text-zinc-700 dark:text-zinc-200">
          {data.items.length === 0 ? (
            <div className="text-sm text-zinc-500">Chưa có chi phí.</div>
          ) : (
            data.items.map((s) => {
              const pct = data.total <= 0 ? 0 : (s.value / data.total) * 100;
              return (
                <div key={s.label} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                    <span className="truncate">{s.label}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">
                      {Math.round(s.value).toLocaleString("vi-VN")}
                    </div>
                    <div className="text-[10px] text-zinc-500">{pct.toFixed(0)}%</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function dmyToIso(dmy: string) {
  const [dd, mm, yyyy] = String(dmy || "").split("/");
  if (!dd || !mm || !yyyy) return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function dmyMonthKey(dmy: string) {
  const [dd, mm, yyyy] = String(dmy || "").split("/");
  if (!mm || !yyyy) return "";
  return `${mm.padStart(2, "0")}/${yyyy}`;
}

function isoMonthKey(iso: string) {
  const [y, m] = String(iso || "").split("-");
  if (!y || !m) return "";
  return `${String(m).padStart(2, "0")}/${y}`;
}

function monthKey(year: number, month: number) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

function addMonths(year: number, month: number, delta: number) {
  // month: 1..12
  const idx = (year * 12 + (month - 1)) + delta;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return { year: y, month: m };
}

function addDaysIso(iso: string, days: number) {
  const [y, m, d] = String(iso || "").split("-").map((x) => Number(x));
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d);
  if (!Number.isFinite(dt.getTime())) return "";
  dt.setDate(dt.getDate() + days);
  return toIsoDate(dt);
}

function reservationDueIso(
  r: any,
  taById: Map<string, any>,
): string {
  const tripIso = dmyToIso(r?.date ?? "");
  if (!tripIso) return "";

  // "Phải Thu" due by trip date. "Ví tài xế" excluded earlier.
  if (r?.paymentType === "Phải Thu") return tripIso;

  // "Công Nợ" due depends on Travel Agent terms if available.
  if (r?.paymentType === "Công Nợ") {
    const ta = r?.travelAgentId ? taById.get(r.travelAgentId) : null;
    const terms = ta?.paymentTerms;
    if (!terms || !terms.mode) return tripIso;

    if (terms.mode === "NEXT_DAY") return addDaysIso(tripIso, 1);

    if (terms.mode === "MONTHLY") {
      const payDay = Number(terms.payDay ?? 0);
      const offsetMonths = Number(terms.offsetMonths ?? 0);
      if (!Number.isFinite(payDay) || payDay <= 0) return tripIso;

      const [y, m] = tripIso.split("-").map((x) => Number(x));
      if (!y || !m) return tripIso;

      // offsetMonths: 0 = cùng tháng, 1 = tháng sau (trả cho tháng trước)
      const dueMonth = m + (offsetMonths === 1 ? 1 : 0);
      const dueYear = y + Math.floor((dueMonth - 1) / 12);
      const mm = ((dueMonth - 1) % 12) + 1;
      const lastDay = new Date(dueYear, mm, 0).getDate();
      const day = Math.min(payDay, lastDay);
      return `${dueYear}-${String(mm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return tripIso;
}

