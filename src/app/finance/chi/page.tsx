"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { useRouter } from "next/navigation";
import {
  type Currency,
  type Reservation,
} from "@/lib/reservations/reservationStore";
import { subscribeActiveReservations } from "@/lib/reservations/reservationsFirestore";
import { type PartnerPaymentTerms, type Supplier } from "@/lib/data/partnersStore";
import { subscribeSuppliers } from "@/lib/data/partnersFirestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDemoSession } from "@/lib/auth/demo";
import { PaymentConfirmDialog } from "@/components/finance/PaymentConfirmDialog";
import type { CashbookEntry } from "@/lib/finance/cashbookStore";
import { addCashbookEntryFs, subscribeCashbookEntries } from "@/lib/finance/cashbookFirestore";
import type { DriverWallet } from "@/lib/fleet/driverWalletStore";
import { adjustDriverWalletBalanceFs, subscribeDriverWallets } from "@/lib/fleet/driverWalletsFirestore";
import type { OtherExpense, OtherExpenseCurrency } from "@/lib/finance/otherExpensesStore";
import { addOtherExpenseFs, subscribeOtherExpenses } from "@/lib/finance/otherExpensesFirestore";
import type { Driver } from "@/lib/fleet/driverStore";
import { subscribeDrivers } from "@/lib/fleet/driversFirestore";
import type { DriverAdvance } from "@/lib/finance/driverAdvancesStore";
import { addDriverAdvanceFs, subscribeDriverAdvances } from "@/lib/finance/driverAdvancesFirestore";
import type { OperatingExpense, OperatingExpenseType, OperatingPaymentMethod } from "@/lib/finance/operatingExpensesStore";
import { addOperatingExpenseFs, subscribeOperatingExpenses } from "@/lib/finance/operatingExpensesFirestore";
import type { Vehicle } from "@/lib/fleet/vehicleStore";
import { subscribeVehicles, upsertVehicleFs } from "@/lib/fleet/vehiclesFirestore";

export default function FinanceChiPage() {
  const router = useRouter();
  const payBtnClass =
    "h-10 rounded-xl px-5 font-semibold text-white shadow-sm " +
    "bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] " +
    "hover:from-[#22B4EC] hover:to-[#0A6EA7] " +
    "active:from-[#169BCF] active:to-[#096596] disabled:opacity-60";
  const [currentUser, setCurrentUser] = React.useState("—");
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [cashbook, setCashbook] = React.useState<CashbookEntry[]>([]);
  const [wallets, setWallets] = React.useState<DriverWallet[]>([]);
  const [supplierById, setSupplierById] = React.useState<Record<string, Supplier>>(
    {},
  );

  const [openDetail, setOpenDetail] = React.useState(false);
  const [detailSupplierId, setDetailSupplierId] = React.useState<string | null>(
    null,
  );
  const [openPayBooking, setOpenPayBooking] = React.useState(false);
  const [payBookingCode, setPayBookingCode] = React.useState<string | null>(null);
  const [openPaySupplier, setOpenPaySupplier] = React.useState(false);
  const [paySupplierId, setPaySupplierId] = React.useState<string | null>(null);
  const [cnYear, setCnYear] = React.useState(() => new Date().getFullYear());
  const [cnMonth, setCnMonth] = React.useState(() => new Date().getMonth() + 1);
  const [paidFlags, setPaidFlags] = React.useState<Record<string, boolean>>({});
  const [openSupplierPdf, setOpenSupplierPdf] = React.useState(false);
  const [supplierPdfTitle, setSupplierPdfTitle] = React.useState<string>("");
  const [supplierPdfUrl, setSupplierPdfUrl] = React.useState<string>("");
  const [supplierPdfBusy, setSupplierPdfBusy] = React.useState(false);
  const [supplierPdfError, setSupplierPdfError] = React.useState<string | null>(null);
  const [supplierPdfSupplierId, setSupplierPdfSupplierId] = React.useState<string | null>(null);

  const [otherExpenses, setOtherExpenses] = React.useState<OtherExpense[]>([]);
  const [openAddOther, setOpenAddOther] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);
  const [openOtherPay, setOpenOtherPay] = React.useState(false);
  const [addForm, setAddForm] = React.useState({
    content: "",
  });

  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [operatingExpenses, setOperatingExpenses] = React.useState<OperatingExpense[]>([]);
  const [openOp, setOpenOp] = React.useState(false);
  const [opType, setOpType] = React.useState<OperatingExpenseType>("VETC");
  const [opError, setOpError] = React.useState<string | null>(null);
  const [openOpPay, setOpenOpPay] = React.useState(false);
  const [opForm, setOpForm] = React.useState({
    vehiclePlate: "",
    amountVnd: "",
    paymentMethod: "TM" as OperatingPaymentMethod,
  });

  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [payrollDriverCode, setPayrollDriverCode] = React.useState<string>("");
  const [payrollFromIso, setPayrollFromIso] = React.useState<string>(() => firstDayOfMonthIso());
  const [payrollToIso, setPayrollToIso] = React.useState<string>(() => todayIso());

  const selectedPayrollDriver = React.useMemo(
    () => drivers.find((d) => d.employeeCode === payrollDriverCode) ?? null,
    [drivers, payrollDriverCode],
  );

  function getWalletByKey(walletKey: string) {
    const k = String(walletKey || "").trim();
    if (!k) return undefined;
    return wallets.find((w) => w.key === k);
  }

  const [advances, setAdvances] = React.useState<DriverAdvance[]>([]);
  const [openAddAdvance, setOpenAddAdvance] = React.useState(false);
  const [advanceError, setAdvanceError] = React.useState<string | null>(null);
  const [advanceAmount, setAdvanceAmount] = React.useState("");
  const [openAdvancePay, setOpenAdvancePay] = React.useState(false);

  const payrollTrips = React.useMemo(() => {
    const name = selectedPayrollDriver?.name?.trim();
    if (!name) return [];
    const from = isoToTs(payrollFromIso);
    const to = isoToTs(payrollToIso);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);

    return reservations
      .filter((r) => r.status === "Đã điều xe")
      .filter((r) => (r.assignedDriver ?? "").trim() === name)
      .filter((r) => {
        const t = dmyToTs(r.date);
        return Number.isFinite(t) && t >= lo && t <= hi;
      })
      .sort((a, b) => dmyToTs(a.date) - dmyToTs(b.date));
  }, [reservations, payrollFromIso, payrollToIso, selectedPayrollDriver]);

  const payrollAdvances = React.useMemo(() => {
    const driver = selectedPayrollDriver;
    if (!driver) return [];
    const from = isoToTs(payrollFromIso);
    const to = isoToTs(payrollToIso);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    return advances
      .filter((a) => a.driverEmployeeCode === driver.employeeCode)
      .filter((a) => {
        const t = dmyToTs(a.createdDate);
        return Number.isFinite(t) && t >= lo && t <= hi;
      })
      .sort((a, b) => dmyToTs(a.createdDate) - dmyToTs(b.createdDate));
  }, [advances, payrollFromIso, payrollToIso, selectedPayrollDriver]);

  const payrollSummary = React.useMemo(() => {
    const part1SalaryVnd = payrollTrips.reduce((sum, r) => {
      if (r.currency !== "VND") return sum;
      const revenue = Number(r.amount ?? 0) || 0;
      return sum + Math.round(revenue * 0.2);
    }, 0);

    const part2AdvancesVnd = payrollAdvances.reduce((sum, a) => sum + (a.amountVnd || 0), 0);

    // Demo rule: Số dư ví lái xe = tổng doanh thu (VND) của booking có hình thức "Ví tài xế"
    // thuộc lái xe và nằm trong khoảng ngày đã chọn.
    const driverName = selectedPayrollDriver?.name?.trim() ?? "";
    const from = isoToTs(payrollFromIso);
    const to = isoToTs(payrollToIso);
    const lo = Number.isFinite(from) && Number.isFinite(to) ? Math.min(from, to) : Number.NaN;
    const hi = Number.isFinite(from) && Number.isFinite(to) ? Math.max(from, to) : Number.NaN;

    const walletVnd =
      driverName && Number.isFinite(lo) && Number.isFinite(hi)
        ? reservations
            .filter((r) => r.paymentType === "Ví tài xế")
            .filter((r) => (r.assignedDriver ?? "").trim() === driverName)
            .filter((r) => r.currency === "VND")
            .filter((r) => {
              const t = dmyToTs(r.date);
              return Number.isFinite(t) && t >= lo && t <= hi;
            })
            .reduce((sum, r) => sum + (Number(r.amount ?? 0) || 0), 0)
        : 0;

    const remaining = part1SalaryVnd - part2AdvancesVnd - walletVnd;

    return {
      part1SalaryVnd,
      part2AdvancesVnd,
      walletVnd,
      remaining,
    };
  }, [payrollAdvances, payrollFromIso, payrollToIso, payrollTrips, reservations, selectedPayrollDriver]);

  const [openPayrollPdf, setOpenPayrollPdf] = React.useState(false);
  const [payrollPdfTitle, setPayrollPdfTitle] = React.useState<string>("");
  const [payrollPdfUrl, setPayrollPdfUrl] = React.useState<string>("");
  const [payrollPdfBusy, setPayrollPdfBusy] = React.useState(false);
  const [payrollPdfError, setPayrollPdfError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCurrentUser(getDemoSession()?.username ?? "—");
    setPaidFlags(readPaidFlags());
    const unsubR = subscribeActiveReservations(setReservations);
    const unsubSup = subscribeSuppliers((rows) =>
      setSupplierById(Object.fromEntries(rows.map((x) => [x.id, x]))),
    );
    const unsubOe = subscribeOtherExpenses(setOtherExpenses);
    const unsubCb = subscribeCashbookEntries(setCashbook);
    const unsubDrivers = subscribeDrivers((rows) => {
      const ds = rows.filter((d) => d.type === "internal");
      setDrivers(ds);
      setPayrollDriverCode((prev) => prev || ds[0]?.employeeCode || "");
    });
    const unsubAdv = subscribeDriverAdvances(setAdvances);
    const unsubOp = subscribeOperatingExpenses(setOperatingExpenses);
    const unsubVeh = subscribeVehicles(setVehicles);
    const unsubW = subscribeDriverWallets(setWallets);
    return () => {
      unsubR();
      unsubSup();
      unsubOe();
      unsubCb();
      unsubDrivers();
      unsubAdv();
      unsubOp();
      unsubVeh();
      unsubW();
    };
  }, []);

  React.useEffect(() => {
    if (!openPayrollPdf) return;
    if (!selectedPayrollDriver) {
      setPayrollPdfError("Vui lòng chọn lái xe.");
      return;
    }
    setPayrollPdfBusy(true);
    setPayrollPdfError(null);
    (async () => {
      const walletKey = `emp:${selectedPayrollDriver.employeeCode}`;
      const w = getWalletByKey(walletKey);
      const walletName = w?.walletName ?? `${selectedPayrollDriver.employeeCode}WD`;
      const balances = w?.balances ?? { VND: 0 };

      const res = await withTimeout(
        fetch("/api/payroll-slip-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: "Get Driver in Vietnam",
            createdDate: new Date().toLocaleDateString("vi-VN"),
            driverName: selectedPayrollDriver.name,
            driverPhone: selectedPayrollDriver.phone,
            fromDate: isoToDmy2(payrollFromIso),
            toDate: isoToDmy2(payrollToIso),
            part1: {
              salary20PctVnd: payrollSummary.part1SalaryVnd,
              allowanceVnd: 0,
              totalVnd: payrollSummary.part1SalaryVnd,
            },
            part2: {
              advancesTotalVnd: payrollSummary.part2AdvancesVnd,
              advances: payrollAdvances.map((a) => ({ date: a.createdDate, amountVnd: a.amountVnd })),
            },
            wallet: {
              walletName,
              balances,
            },
            part4: {
              receiveVnd: Math.max(payrollSummary.remaining, 0),
            },
          }),
        }),
        15000,
        "Tạo PDF quá lâu (timeout). Vui lòng thử lại.",
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message ?? "Tạo PDF thất bại.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPayrollPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPayrollPdfTitle(selectedPayrollDriver.name);
    })()
      .catch((e) => setPayrollPdfError(String(e?.message ?? e)))
      .finally(() => setPayrollPdfBusy(false));
  }, [openPayrollPdf, selectedPayrollDriver, payrollFromIso, payrollToIso, payrollSummary, payrollAdvances]);

  React.useEffect(() => {
    if (!openSupplierPdf) return;
    if (!supplierPdfSupplierId) return;
    setSupplierPdfBusy(true);
    setSupplierPdfError(null);
    (async () => {
      const supplierId = supplierPdfSupplierId;
      const s = supplierId !== "—" ? supplierById[supplierId] : undefined;
      const title = s?.name ?? "Supplier";

      const rows = reservations
        .filter((r) => Boolean(r.assignedSupplierId))
        .filter((r) => (r.assignedSupplierId ?? "—") === supplierId)
        .filter((r) => r.assignedSupplierPaymentType === "Công Nợ")
        .filter((r) => isInMonthYearDmy(r.date, cnMonth, cnYear))
        .sort((a, b) => dmyToTs(a.date) - dmyToTs(b.date))
        .map((r, idx) => ({
          stt: idx + 1,
          date: r.date,
          customerName: r.customerName,
          itinerary: r.itinerary || `${r.pickup} → ${r.dropoff}`,
          qty: Number(r.unitQty ?? 0) || 0,
          unitPrice: Number(r.unitPrice ?? 0) || 0,
          amount: Number(r.amount ?? 0) || 0,
          thuHo: Number(r.thuHoAmount ?? 0) || 0,
          thuHoCurrency: String(r.thuHoCurrency || "VND"),
        }));

      const res = await withTimeout(
        fetch("/api/supplier-statement-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: "Get Driver in Vietnam",
            createdDate: new Date().toLocaleDateString("vi-VN"),
            supplierName: title,
            month: cnMonth,
            year: cnYear,
            rows,
          }),
        }),
        15000,
        "Tạo PDF quá lâu (timeout). Vui lòng thử lại.",
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message ?? "Tạo PDF thất bại.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setSupplierPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setSupplierPdfTitle(title);
    })()
      .catch((e) => setSupplierPdfError(String(e?.message ?? e)))
      .finally(() => setSupplierPdfBusy(false));
  }, [openSupplierPdf, supplierPdfSupplierId, reservations, supplierById, cnMonth, cnYear]);

  const payable = reservations.filter((r) => Boolean(r.assignedSupplierId));
  const phaiTra = payable.filter((r) => r.assignedSupplierPaymentType === "Phải Trả");
  const congNo = payable
    .filter((r) => r.assignedSupplierPaymentType === "Công Nợ")
    .filter((r) => isInMonthYearDmy(r.date, cnMonth, cnYear));

  const paidByBookingCurrency = React.useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const e of cashbook) {
      if (e.direction !== "OUT") continue;
      if (e.referenceType !== "AP_SUP_BOOKING") continue;
      const code = String(e.referenceId || "");
      if (!code) continue;
      const cur = String(e.currency || "VND").trim().toUpperCase() || "VND";
      const curr = m.get(code) ?? {};
      curr[cur] = (curr[cur] ?? 0) + (Number(e.amount ?? 0) || 0);
      m.set(code, curr);
    }
    return m;
  }, [cashbook]);

  const paidBySupplierCurrency = React.useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const e of cashbook) {
      if (e.referenceType === "AP_SUPPLIER" && (e.direction === "OUT" || e.direction === "IN")) {
        const id = String(e.referenceId || "");
        if (!id) continue;
        const cur = String(e.currency || "VND").trim().toUpperCase() || "VND";
        const curr = m.get(id) ?? {};
        const signed = e.direction === "OUT" ? (Number(e.amount ?? 0) || 0) : -(Number(e.amount ?? 0) || 0);
        curr[cur] = (curr[cur] ?? 0) + signed;
        m.set(id, curr);
      }
      if (e.referenceType === "AP_SUP_BOOKING" && e.direction === "OUT") {
        const code = String(e.referenceId || "");
        if (!code) continue;
        const booking = reservations.find((r) => r.code === code);
        const supplierId = booking?.assignedSupplierId ?? "";
        if (!supplierId) continue;
        const periodKey = supplierPaidKey(supplierId, cnMonth, cnYear);
        const cur = String(e.currency || "VND").trim().toUpperCase() || "VND";
        const curr = m.get(periodKey) ?? {};
        curr[cur] = (curr[cur] ?? 0) + (Number(e.amount ?? 0) || 0);
        m.set(periodKey, curr);
      }
    }
    return m;
  }, [cashbook, reservations, cnMonth, cnYear]);

  const congNoBySupplier = React.useMemo(() => {
    const m = new Map<
      string,
      {
        supplierId: string;
        totalByCurrency: Record<Currency, number>;
        thuHoByCurrency: Record<Currency, number>;
        bookings: Reservation[];
      }
    >();
    for (const r of congNo) {
      const supplierId = r.assignedSupplierId ?? "—";
      const cur = r.currency ?? "VND";
      const thuCur = r.thuHoCurrency ?? "VND";
      const entry =
        m.get(supplierId) ??
        {
          supplierId,
          totalByCurrency: { VND: 0, USD: 0 },
          thuHoByCurrency: { VND: 0, USD: 0 },
          bookings: [],
        };
      entry.totalByCurrency[cur] += Number(r.amount ?? 0) || 0;
      entry.thuHoByCurrency[thuCur] += Number(r.thuHoAmount ?? 0) || 0;
      entry.bookings.push(r);
      m.set(supplierId, entry);
    }
    const rows = Array.from(m.values());
    rows.sort((a, b) => b.totalByCurrency.VND - a.totalByCurrency.VND);
    return rows;
  }, [congNo]);

  return (
    <AppShell>
      <div className="px-6 pb-10">
        <div className="pt-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Chi
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Tổng hợp các khoản phải thanh toán và công nợ theo Supplier (demo).
          </p>

          <div className="mt-5 grid gap-6">
            <Section
              title="Các khoản phải thanh toán"
              subtitle='Lấy từ booking có Supplier và hình thức thanh toán là "Phải Trả"'
            >
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                    <tr>
                      <th className="px-3 py-2">Supplier</th>
                      <th className="px-3 py-2">Tên Khách</th>
                      <th className="px-3 py-2">Ngày đi</th>
                      <th className="px-3 py-2">Giờ đi</th>
                      <th className="px-3 py-2">Hành Trình</th>
                      <th className="px-3 py-2 text-right">Số Tiền</th>
                      <th className="px-3 py-2 text-right">Thu Hộ</th>
                      <th className="px-3 py-2">Hạn Thanh Toán</th>
                      <th className="px-3 py-2 text-right">Thanh Toán</th>
                      <th className="px-3 py-2 text-center">Đã Trả Đủ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {phaiTra.map((r) => {
                      const s = r.assignedSupplierId
                        ? supplierById[r.assignedSupplierId]
                        : undefined;
                      const cur = String(r.currency || "VND").trim().toUpperCase() || "VND";
                      const total = Number(r.amount ?? 0) || 0;
                      const paid = paidByBookingCurrency.get(r.code)?.[cur] ?? 0;
                      const remaining = Math.max(total - paid, 0);
                      const flagKey = paidFlagKeyBooking(r.code);
                      const forcedPaid = Boolean(paidFlags[flagKey]);
                      return (
                        <tr key={r.code} className="bg-white dark:bg-zinc-950">
                          <td className="px-3 py-2">{s?.name ?? "—"}</td>
                          <td className="px-3 py-2">{r.customerName}</td>
                          <td className="px-3 py-2">{r.date}</td>
                          <td className="px-3 py-2">{r.time}</td>
                          <td className="px-3 py-2">{r.itinerary || "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {(r.amount ?? 0).toLocaleString("vi-VN")} {r.currency}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r.thuHoAmount > 0
                              ? `${r.thuHoAmount.toLocaleString("vi-VN")} ${r.thuHoCurrency}`
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {dueDateForSupplier({
                              serviceDateDmy: r.date,
                              paymentType: r.assignedSupplierPaymentType ?? "Phải Trả",
                              terms: r.assignedSupplierId
                                ? supplierById[r.assignedSupplierId]?.paymentTerms
                                : undefined,
                            })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              className="h-10 rounded-xl px-5 font-semibold text-white shadow-sm bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] hover:from-[#22B4EC] hover:to-[#0A6EA7] active:from-[#169BCF] active:to-[#096596] disabled:opacity-60"
                              disabled={forcedPaid || remaining <= 0}
                              onClick={() => {
                                setPayBookingCode(r.code);
                                setOpenPayBooking(true);
                              }}
                              title={remaining > 0 ? `Còn lại: ${remaining.toLocaleString("vi-VN")} ${cur}` : "Đã trả đủ"}
                            >
                              Thanh toán
                            </Button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={forcedPaid}
                              onChange={(e) => {
                                const next = { ...paidFlags, [flagKey]: e.target.checked };
                                setPaidFlags(next);
                                writePaidFlags(next);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}

                    {phaiTra.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">
                          Chưa có khoản phải thanh toán.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              title="Công nợ phải thanh toán"
              subtitle='Lấy từ booking có Supplier và hình thức thanh toán là "Công Nợ" (gom theo Supplier)'
            >
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">Năm</div>
                  <select
                    className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                    value={cnYear}
                    onChange={(e) => setCnYear(Number(e.target.value))}
                  >
                    {yearChoices(new Date().getFullYear()).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-4 grid grid-cols-6 gap-2">
                {Array.from({ length: 12 }).map((_, idx) => {
                  const m = idx + 1;
                  const active = cnMonth === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCnMonth(m)}
                      className={`h-9 rounded-lg px-3 text-sm border ${
                        active
                          ? "border-[#2E7AB0] bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200"
                      }`}
                    >
                      Tháng {m}
                    </button>
                  );
                })}
              </div>
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                    <tr>
                      <th className="px-3 py-2">STT</th>
                      <th className="px-3 py-2">Supplier</th>
                      <th className="px-3 py-2 text-right">Doanh Thu</th>
                      <th className="px-3 py-2 text-right">Thu Hộ</th>
                      <th className="px-3 py-2 text-right">Phải Trả (Hoàn)</th>
                      <th className="px-3 py-2 text-right">Thanh toán</th>
                      <th className="px-3 py-2 text-center">Đã Trả Đủ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {congNoBySupplier.map((row, idx) => {
                      const s =
                        row.supplierId !== "—"
                          ? supplierById[row.supplierId]
                          : undefined;
                      const vnd = Math.round(row.totalByCurrency.VND ?? 0);
                      const usd = Math.round(row.totalByCurrency.USD ?? 0);
                      const thuVnd = Math.round(row.thuHoByCurrency.VND ?? 0);
                      const thuUsd = Math.round(row.thuHoByCurrency.USD ?? 0);
                      const key = supplierPaidKey(row.supplierId, cnMonth, cnYear);
                      const paidVnd = Math.round(paidBySupplierCurrency.get(key)?.VND ?? 0);
                      const paidUsd = Math.round(paidBySupplierCurrency.get(key)?.USD ?? 0);
                      const netVnd = vnd - thuVnd - paidVnd;
                      const netUsd = usd - thuUsd - paidUsd;
                      const anyNet = netVnd !== 0 || netUsd !== 0;
                      const flagKey = paidFlagKeySupplierMonth(row.supplierId, cnMonth, cnYear);
                      const forcedPaid = Boolean(paidFlags[flagKey]);
                      return (
                        <tr
                          key={row.supplierId}
                          className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900/30 cursor-default"
                          onDoubleClick={() => {
                            setDetailSupplierId(row.supplierId);
                            setOpenDetail(true);
                          }}
                          title="Double click để xem bảng kê chi tiết"
                        >
                          <td className="px-3 py-2">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="text-left font-medium text-zinc-900 underline decoration-dotted underline-offset-4 hover:text-[#0B79B8] dark:text-zinc-50"
                              onClick={() => {
                                setSupplierPdfSupplierId(row.supplierId);
                                setOpenSupplierPdf(true);
                              }}
                              title="Bấm để xem PDF"
                              disabled={row.supplierId === "—"}
                            >
                              {s?.name ?? "—"}
                            </button>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{row.supplierId}</div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <MoneyStack
                              vndLabel={`${vnd.toLocaleString("vi-VN")} VND`}
                              usdLabel={`${usd.toLocaleString("en-US")} USD`}
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <MoneyStack
                              vndLabel={thuVnd ? `${thuVnd.toLocaleString("vi-VN")} VND` : "—"}
                              usdLabel={thuUsd ? `${thuUsd.toLocaleString("en-US")} USD` : "—"}
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <MoneyStack
                              vndLabel={`${netVnd.toLocaleString("vi-VN")} VND`}
                              usdLabel={`${netUsd.toLocaleString("en-US")} USD`}
                              vndNegative={netVnd < 0}
                              usdNegative={netUsd < 0}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              className="h-10 rounded-xl px-5 font-semibold text-white shadow-sm bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] hover:from-[#22B4EC] hover:to-[#0A6EA7] active:from-[#169BCF] active:to-[#096596] disabled:opacity-60"
                              disabled={forcedPaid || !anyNet || row.supplierId === "—"}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPaySupplierId(row.supplierId);
                                setOpenPaySupplier(true);
                              }}
                            >
                              Thanh toán
                            </Button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={forcedPaid}
                              disabled={row.supplierId === "—"}
                              onChange={(e) => {
                                const next = { ...paidFlags, [flagKey]: e.target.checked };
                                setPaidFlags(next);
                                writePaidFlags(next);
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}

                    {congNoBySupplier.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                          Chưa có công nợ phải thanh toán.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              title="Chi phí văn phòng"
              subtitle="Các khoản cố định theo tháng + quản lý thanh toán"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <OfficeCard
                  title="Các Khoản Phải Chi Văn Phòng"
                  desc="Danh sách nghĩa vụ chi theo kỳ và hạn thanh toán."
                  button="Xem danh sách"
                  onClick={() => router.push("/finance/phai-tra")}
                />
                <OfficeCard
                  title="Danh Mục Chi Phí Văn Phòng"
                  desc="Thiết lập kỳ bắt đầu/kết thúc và kết thúc trước hạn."
                  button="Quản lý danh mục"
                  onClick={() => router.push("/finance/danh-muc-chi-van-phong")}
                />
              </div>
            </Section>
            <Section title="Chi phí vận hành" subtitle="VETC / Nhiên liệu / Bảo dưỡng / Thay dầu">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <OpButton
                    label="VETC"
                    onClick={() => openOperating("VETC", setOpenOp, setOpType, setOpError, setOpForm)}
                  />
                  <OpButton
                    label="Nhiên Liệu"
                    onClick={() => openOperating("Nhiên Liệu", setOpenOp, setOpType, setOpError, setOpForm)}
                  />
                  <OpButton
                    label="Bảo Dưỡng"
                    onClick={() => openOperating("Bảo Dưỡng", setOpenOp, setOpType, setOpError, setOpForm)}
                  />
                  <OpButton
                    label="Thay Dầu"
                    onClick={() => openOperating("Thay Dầu", setOpenOp, setOpType, setOpError, setOpForm)}
                  />
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                      <tr>
                        <th className="px-3 py-2">Loại</th>
                        <th className="px-3 py-2">Xe</th>
                        <th className="px-3 py-2 text-right">Số tiền</th>
                        <th className="px-3 py-2">Hình thức</th>
                        <th className="px-3 py-2">Ngày</th>
                        <th className="px-3 py-2">Giờ</th>
                        <th className="px-3 py-2">Người tạo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-900 dark:bg-zinc-950">
                      {operatingExpenses.slice(0, 10).map((x) => (
                        <tr key={x.id}>
                          <td className="px-3 py-3 font-medium">{x.type}</td>
                          <td className="px-3 py-3">{x.vehiclePlate ?? "—"}</td>
                          <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                            {x.amountVnd.toLocaleString("vi-VN")} VND
                          </td>
                          <td className="px-3 py-3">{x.paymentMethod}</td>
                          <td className="px-3 py-3">{x.createdDate}</td>
                          <td className="px-3 py-3">{x.createdTime}</td>
                          <td className="px-3 py-3">{x.createdBy}</td>
                        </tr>
                      ))}

                      {operatingExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                            Chưa có chi phí vận hành.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
            <Section title="Lương lái xe" subtitle="Bảng kê / phiếu lương / tạm ứng">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-[240px_220px_220px] md:items-end">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Lái xe</label>
                    <select
                      className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                      value={payrollDriverCode}
                      onChange={(e) => setPayrollDriverCode(e.target.value)}
                    >
                      {drivers.map((d) => (
                        <option key={d.employeeCode} value={d.employeeCode}>
                          {d.name}
                        </option>
                      ))}
                      {drivers.length === 0 ? (
                        <option value="">—</option>
                      ) : null}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Từ ngày</label>
                    <input
                      type="date"
                      value={payrollFromIso}
                      onChange={(e) => setPayrollFromIso(e.target.value)}
                      className="gdvn-date h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium">Đến ngày</label>
                    <input
                      type="date"
                      value={payrollToIso}
                      onChange={(e) => setPayrollToIso(e.target.value)}
                      className="gdvn-date h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      className="h-10 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                      variant="primary"
                      onClick={() => {
                        setPayrollPdfError(null);
                        setOpenPayrollPdf(true);
                      }}
                    >
                      Phiếu lương
                    </Button>
                    <Button
                      className="h-10 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                      variant="primary"
                      onClick={() => {
                        setAdvanceError(null);
                        setAdvanceAmount("");
                        setOpenAddAdvance(true);
                      }}
                    >
                      Tạm ứng
                    </Button>
                  </div>
                </div>

                {payrollDriverCode ? (
                  <div className="mt-4 rounded-2xl border border-zinc-200 bg-gradient-to-r from-sky-50 to-white px-6 py-6 shadow-sm dark:border-zinc-800 dark:from-zinc-900/30 dark:to-zinc-950">
                    <div className="text-center">
                      <div className="text-xs font-semibold tracking-[0.18em] text-sky-700/80 dark:text-sky-300/80">
                        CHI PHÍ LƯƠNG LÁI XE
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                        {selectedPayrollDriver?.name ?? "—"}{" "}
                        · {isoToDmy2(payrollFromIso)} — {isoToDmy2(payrollToIso)}
                      </div>
                      <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                        Lương theo doanh số 20% + phụ cấp · {payrollTrips.length} chuyến
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Phần 1: Lương theo doanh thu và phụ cấp
                  </div>
                  <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                        <tr>
                          <th className="px-3 py-2">STT</th>
                          <th className="px-3 py-2">Ngày đi</th>
                          <th className="px-3 py-2">Tên khách</th>
                          <th className="px-3 py-2">Hành trình</th>
                          <th className="px-3 py-2 text-right">Doanh thu</th>
                          <th className="px-3 py-2 text-right">
                            Lương doanh số (20%)
                          </th>
                          <th className="px-3 py-2 text-center">Phụ cấp</th>
                          <th className="px-3 py-2 text-right">Tổng nhận</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-900 dark:bg-zinc-950">
                        {payrollTrips.map((r, idx) => {
                          const revenue = Number(r.amount ?? 0) || 0;
                          const salary = Math.round(revenue * 0.2);
                          const allowance = 0;
                          const total = salary + allowance;
                          const cur = r.currency ?? "VND";
                          return (
                            <tr key={r.code} className="align-top">
                              <td className="px-3 py-3">{idx + 1}</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {r.date}
                              </td>
                              <td className="px-3 py-3">
                                {r.customerName?.trim() ? r.customerName : "Không có tên"}
                              </td>
                              <td className="px-3 py-3 max-w-[320px]">
                                <div className="line-clamp-4 text-zinc-700 dark:text-zinc-200">
                                  {r.pickup} → {r.dropoff}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                                {revenue.toLocaleString("vi-VN")} {cur}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                                {salary.toLocaleString("vi-VN")} {cur}
                              </td>
                              <td className="px-3 py-3 text-center">—</td>
                              <td className="px-3 py-3 text-right tabular-nums font-semibold whitespace-nowrap">
                                {total.toLocaleString("vi-VN")} {cur}
                              </td>
                            </tr>
                          );
                        })}

                        {payrollTrips.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-3 py-10 text-center text-zinc-500"
                            >
                              Chưa có chuyến trong khoảng ngày đã chọn.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Phần 2: Tạm ứng
                  </div>
                  <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                        <tr>
                          <th className="px-3 py-2">STT</th>
                          <th className="px-3 py-2">Ngày tạm ứng</th>
                          <th className="px-3 py-2 text-right">Số tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-900 dark:bg-zinc-950">
                        {payrollAdvances.map((a, idx) => (
                          <tr key={a.id}>
                            <td className="px-3 py-3">{idx + 1}</td>
                            <td className="px-3 py-3">{a.createdDate}</td>
                            <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                              {a.amountVnd.toLocaleString("vi-VN")} VND
                            </td>
                          </tr>
                        ))}

                        {payrollAdvances.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-3 py-8 text-zinc-500"
                            >
                              Chưa có tạm ứng trong khoản ngày đã chọn.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Phần 4: Số tiền còn phải thanh toán
                  </div>
                  <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
                      <Row
                        label="Lương theo doanh thu & phụ cấp (Phần 1)"
                        value={`${payrollSummary.part1SalaryVnd.toLocaleString("vi-VN")} VND`}
                        strong
                      />
                      <Row
                        label="Trừ tạm ứng (Phần 2)"
                        value={`${payrollSummary.part2AdvancesVnd.toLocaleString("vi-VN")} VND`}
                      />
                      <Row
                        label="Trừ Số Dư ví lái xe"
                        value={`${payrollSummary.walletVnd.toLocaleString("vi-VN")} VND`}
                      />
                      <Row
                        label="Số tiền còn phải thanh toán"
                        value={`${Math.max(payrollSummary.remaining, 0).toLocaleString("vi-VN")} VND`}
                        strong
                        emphasize
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Section>
            <Section
              title="Các khoản chi khác"
              subtitle="Nhập các khoản chi không nằm trong danh mục"
            >
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">
                    Người chi: <b>{currentUser}</b>
                  </div>
                  <Button
                    className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                    onClick={() => {
                      setAddError(null);
                      setAddForm({ content: "" });
                      setOpenAddOther(true);
                    }}
                  >
                    + Thêm
                  </Button>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                      <tr>
                        <th className="px-3 py-2">Nội dung chi</th>
                        <th className="px-3 py-2 text-right">Số tiền</th>
                        <th className="px-3 py-2">Đơn vị tiền</th>
                        <th className="px-3 py-2">Người chi</th>
                        <th className="px-3 py-2">Ngày chi</th>
                        <th className="px-3 py-2">Giờ chi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                      {otherExpenses.map((x) => (
                        <tr key={x.id} className="bg-white dark:bg-zinc-950">
                          <td className="px-3 py-2 font-medium">{x.content}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {x.amount.toLocaleString("vi-VN")}
                          </td>
                          <td className="px-3 py-2">{x.currency}</td>
                          <td className="px-3 py-2">{x.user}</td>
                          <td className="px-3 py-2">{x.createdDate}</td>
                          <td className="px-3 py-2">{x.createdTime}</td>
                        </tr>
                      ))}

                      {otherExpenses.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-8 text-center text-zinc-500"
                          >
                            Chưa có khoản chi khác.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>

      <Dialog
        open={openDetail}
        onOpenChange={(v) => {
          setOpenDetail(v);
          if (!v) setDetailSupplierId(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Bảng kê công nợ chi tiết</DialogTitle>
            <DialogDescription>
              {detailSupplierId
                ? supplierById[detailSupplierId]?.name ?? detailSupplierId
                : "—"}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2">Tên khách</th>
                  <th className="px-3 py-2">Ngày đi</th>
                  <th className="px-3 py-2">Giờ đi</th>
                  <th className="px-3 py-2">Điểm đón</th>
                  <th className="px-3 py-2">Điểm trả</th>
                  <th className="px-3 py-2 text-right">Số tiền</th>
                  <th className="px-3 py-2 text-right">Thu hộ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {detailSupplierId
                  ? congNo
                      .filter((r) => (r.assignedSupplierId ?? "—") === detailSupplierId)
                      .map((r) => (
                        <tr key={r.code} className="bg-white dark:bg-zinc-950">
                          <td className="px-3 py-2 font-medium">{r.customerName}</td>
                          <td className="px-3 py-2">{r.date}</td>
                          <td className="px-3 py-2">{r.time}</td>
                          <td className="px-3 py-2">{r.pickup}</td>
                          <td className="px-3 py-2">{r.dropoff}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {(r.amount ?? 0).toLocaleString("vi-VN")} {r.currency}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r.thuHoAmount > 0
                              ? `${r.thuHoAmount.toLocaleString("vi-VN")} ${r.thuHoCurrency}`
                              : "—"}
                          </td>
                        </tr>
                      ))
                  : null}

                {detailSupplierId &&
                congNo.filter((r) => (r.assignedSupplierId ?? "—") === detailSupplierId)
                  .length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                      Không có dữ liệu.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openAddOther} onOpenChange={setOpenAddOther}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm khoản chi khác</DialogTitle>
            <DialogDescription>
              Nhập: Nội dung chi - Số tiền - Đơn vị tiền. Người chi / Ngày / Giờ sẽ
              tự động lấy theo user và thời điểm thực hiện.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Field label="Nội Dung Chi">
              <Input
                value={addForm.content}
                onChange={(e) => setAddForm({ ...addForm, content: e.target.value })}
                placeholder="VD: Mua văn phòng phẩm..."
              />
            </Field>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Người Chi">
                <Input value={currentUser} readOnly />
              </Field>
              <Field label="Ngày Chi">
                <Input value={new Date().toLocaleDateString("vi-VN")} readOnly />
              </Field>
              <Field label="Giờ Chi">
                <Input
                  value={new Date().toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  readOnly
                />
              </Field>
            </div>

            {addError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {addError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                className="h-9"
                onClick={() => setOpenAddOther(false)}
              >
                Huỷ
              </Button>
              <Button
                className={payBtnClass + " h-9 px-4"}
                onClick={() => {
                  setAddError(null);
                  if (!addForm.content.trim()) return setAddError("Vui lòng nhập Nội dung chi.");
                  setOpenOtherPay(true);
                }}
              >
                Thanh toán
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentConfirmDialog
        open={openOtherPay}
        onOpenChange={setOpenOtherPay}
        title="Thanh toán khoản chi khác"
        description="Bước 1: chọn nguồn tiền. Bước 2: chọn loại tiền và nhập số tiền."
        defaultCurrency={"VND" as any}
        onConfirm={async (r) => {
          setAddError(null);
          if (!addForm.content.trim()) return setAddError("Vui lòng nhập Nội dung chi.");
          const amount = Math.round(Number(r.amount ?? 0) || 0);
          if (!Number.isFinite(amount) || amount <= 0) return setAddError("Số tiền không hợp lệ.");
          const cur = String(r.currency || "VND").trim().toUpperCase() || "VND";
          if (cur !== "VND" && cur !== "USD") {
            return setAddError("Khoản chi khác hiện chỉ hỗ trợ VND hoặc USD.");
          }

          const oex = await addOtherExpenseFs({
            content: addForm.content,
            amount,
            currency: cur as OtherExpenseCurrency,
          });

          await addCashbookEntryFs({
            direction: "OUT",
            sourceId: r.sourceId,
            currency: cur,
            amount,
            method: r.sourceId === "CASH" ? "TM" : "CK",
            content: `Chi khác • ${addForm.content.trim()}`,
            referenceType: "OTHER_EXPENSE",
            referenceId: oex.id,
          });
          if (r.sourceId.startsWith("WALLET:")) {
            const walletKey = r.sourceId.slice("WALLET:".length);
            await adjustDriverWalletBalanceFs(walletKey, cur, -amount);
          }

          setAddForm({ content: "" });
          setOpenAddOther(false);
        }}
      />

      <Dialog
        open={openAddAdvance}
        onOpenChange={(v) => {
          setOpenAddAdvance(v);
          if (!v) setAdvanceError(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạm ứng</DialogTitle>
            <DialogDescription>
              {selectedPayrollDriver?.name
                ? `Lái xe: ${selectedPayrollDriver.name} (${isoToDmy2(payrollFromIso)} — ${isoToDmy2(payrollToIso)})`
                : "Chọn lái xe trước khi tạm ứng."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Field label="Số tiền (VND)">
              <Input
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </Field>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Người tạo">
                <Input value={currentUser} readOnly />
              </Field>
              <Field label="Ngày">
                <Input value={new Date().toLocaleDateString("vi-VN")} readOnly />
              </Field>
              <Field label="Giờ">
                <Input
                  value={new Date().toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  readOnly
                />
              </Field>
            </div>

            {advanceError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {advanceError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                className="h-9"
                onClick={() => setOpenAddAdvance(false)}
              >
                Huỷ
              </Button>
              <Button
                className={payBtnClass + " h-9 px-4"}
                onClick={() => {
                  setAdvanceError(null);
                  if (!selectedPayrollDriver) {
                    return setAdvanceError("Vui lòng chọn lái xe.");
                  }
                  const amount = Number(advanceAmount.replace(/[^\d]/g, ""));
                  if (!Number.isFinite(amount) || amount <= 0) {
                    return setAdvanceError("Số tiền không hợp lệ.");
                  }
                  setOpenAdvancePay(true);
                }}
              >
                Thanh toán
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentConfirmDialog
        open={openAdvancePay}
        onOpenChange={setOpenAdvancePay}
        title="Thanh toán tạm ứng"
        description="Bước 1: chọn nguồn tiền. Bước 2: nhập số tiền."
        defaultCurrency="VND"
        lockCurrencyTo="VND"
        defaultAmount={Number(advanceAmount.replace(/[^\d]/g, "")) || undefined}
        onConfirm={async (r) => {
          setAdvanceError(null);
          if (!selectedPayrollDriver) return setAdvanceError("Vui lòng chọn lái xe.");
          const amount = Math.round(Number(r.amount ?? 0) || 0);
          if (!amount || amount <= 0) return setAdvanceError("Số tiền không hợp lệ.");

          const adv = await addDriverAdvanceFs({
            driverEmployeeCode: selectedPayrollDriver.employeeCode,
            driverName: selectedPayrollDriver.name,
            amountVnd: amount,
          });

          await addCashbookEntryFs({
            direction: "OUT",
            sourceId: r.sourceId,
            currency: "VND",
            amount,
            method: r.sourceId === "CASH" ? "TM" : "CK",
            content: `Tạm ứng • ${selectedPayrollDriver.name} • ${selectedPayrollDriver.employeeCode}`,
            referenceType: "DRIVER_ADVANCE",
            referenceId: adv.id,
          });
          if (r.sourceId.startsWith("WALLET:")) {
            const walletKey = r.sourceId.slice("WALLET:".length);
            await adjustDriverWalletBalanceFs(walletKey, "VND", -amount);
          }
          setAdvanceAmount("");
          setOpenAddAdvance(false);
        }}
      />

      <Dialog
        open={openOp}
        onOpenChange={(v) => {
          setOpenOp(v);
          if (!v) setOpError(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{opType}</DialogTitle>
            <DialogDescription>
              {opType === "VETC"
                ? "Nhập số tiền cần nạp và bấm Thanh toán."
                : "Chọn xe công ty, nhập số tiền và bấm Thanh toán."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {opType !== "VETC" ? (
              <Field label="Chọn xe (xe công ty)">
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                  value={opForm.vehiclePlate}
                  onChange={(e) => setOpForm({ ...opForm, vehiclePlate: e.target.value })}
                >
                  <option value="">—</option>
                  {vehicles.map((v) => (
                    <option key={v.plate} value={v.plate}>
                      {v.plate} • {v.name} • {v.type}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label={opType === "VETC" ? "Số tiền cần nạp (VND)" : "Số tiền (VND)"}>
              <Input
                value={opForm.amountVnd}
                onChange={(e) => setOpForm({ ...opForm, amountVnd: e.target.value })}
                inputMode="numeric"
                placeholder="0"
              />
            </Field>

            <div>
              <Button
                className={payBtnClass + " w-full"}
                onClick={() => {
                  setOpError(null);
                  const amount = Number(opForm.amountVnd.replace(/[^\d]/g, ""));
                  if (!Number.isFinite(amount) || amount <= 0) {
                    return setOpError("Số tiền không hợp lệ.");
                  }
                  if (opType !== "VETC" && !opForm.vehiclePlate) {
                    return setOpError("Vui lòng chọn xe.");
                  }
                  setOpenOpPay(true);
                }}
              >
                Thanh toán
              </Button>
            </div>

            {opError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {opError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" className="h-9" onClick={() => setOpenOp(false)}>
                Huỷ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentConfirmDialog
        open={openOpPay}
        onOpenChange={setOpenOpPay}
        title={`Thanh toán ${opType}`}
        description="Bước 1: chọn nguồn tiền. Bước 2: nhập số tiền."
        defaultCurrency="VND"
        lockCurrencyTo="VND"
        defaultAmount={Number(opForm.amountVnd.replace(/[^\d]/g, "")) || undefined}
        onConfirm={async (r) => {
          setOpError(null);
          const amount = Math.round(Number(r.amount ?? 0) || 0);
          if (!amount || amount <= 0) return setOpError("Số tiền không hợp lệ.");
          if (opType === "VETC" && r.sourceId.startsWith("WALLET:")) {
            return setOpError("VETC chỉ cho phép Tiền Mặt hoặc Tài khoản ngân hàng.");
          }
          if (opType !== "VETC" && !opForm.vehiclePlate) return setOpError("Vui lòng chọn xe.");

          const ope = await addOperatingExpenseFs({
            type: opType,
            vehiclePlate: opType === "VETC" ? undefined : opForm.vehiclePlate,
            amountVnd: amount,
            paymentMethod: r.sourceId.startsWith("WALLET:") ? "Ví tài xế" : r.sourceId === "CASH" ? "TM" : "CK",
          });

          await addCashbookEntryFs({
            direction: "OUT",
            sourceId: r.sourceId,
            currency: "VND",
            amount,
            method: r.sourceId === "CASH" ? "TM" : "CK",
            content: `Chi vận hành • ${opType}${opType === "VETC" ? "" : ` • ${opForm.vehiclePlate}`}`,
            referenceType: "OP_EXPENSE",
            referenceId: ope.id,
          });

          if (r.sourceId.startsWith("WALLET:")) {
            const walletKey = r.sourceId.slice("WALLET:".length);
            await adjustDriverWalletBalanceFs(walletKey, "VND", -amount);
          }

          // Sync to vehicle status: paying "Thay Dầu" or "Bảo Dưỡng" implies done at current km.
          if (opType === "Thay Dầu" || opType === "Bảo Dưỡng") {
            const plate = opForm.vehiclePlate;
            const current = vehicles.find((x) => x.plate.toLowerCase() === plate.toLowerCase());
            if (current) {
              const next: Vehicle = {
                ...current,
                lastOilChangeKm: opType === "Thay Dầu" ? current.km : current.lastOilChangeKm,
                lastServiceKm: opType === "Bảo Dưỡng" ? current.km : current.lastServiceKm,
                updatedAt: Date.now(),
              };
              await upsertVehicleFs(next);
            }
          }

          setOpenOp(false);
        }}
      />

      <PaymentConfirmDialog
        open={openPayBooking}
        onOpenChange={(v) => {
          setOpenPayBooking(v);
          if (!v) setPayBookingCode(null);
        }}
        title="Thanh toán booking"
        description="Ghi nhận chi tiền thực tế vào Sổ thu chi."
        defaultCurrency={
          (() => {
            const b = reservations.find((x) => x.code === payBookingCode);
            return (String(b?.currency || "VND").trim().toUpperCase() || "VND") as any;
          })()
        }
        lockCurrencyTo={
          (() => {
            const b = reservations.find((x) => x.code === payBookingCode);
            return (String(b?.currency || "VND").trim().toUpperCase() || "VND") as any;
          })()
        }
        defaultAmount={
          (() => {
            const b = reservations.find((x) => x.code === payBookingCode);
            if (!b) return undefined;
            const cur = String(b.currency || "VND").trim().toUpperCase() || "VND";
            const total = Number(b.amount ?? 0) || 0;
            const paid = paidByBookingCurrency.get(b.code)?.[cur] ?? 0;
            const remaining = Math.max(total - paid, 0);
            return remaining > 0 ? remaining : undefined;
          })()
        }
        onConfirm={async (r) => {
          if (!payBookingCode) return;
          const b = reservations.find((x) => x.code === payBookingCode);
          const supplierName = b?.assignedSupplierId ? supplierById[b.assignedSupplierId]?.name : undefined;
          await addCashbookEntryFs({
            direction: "OUT",
            sourceId: r.sourceId,
            currency: r.currency as any,
            amount: r.amount,
            method: r.sourceId === "CASH" ? "TM" : "CK",
            content: `Chi • Supplier ${supplierName ?? b?.assignedSupplierId ?? "—"} • Booking ${payBookingCode}`,
            referenceType: "AP_SUP_BOOKING",
            referenceId: payBookingCode,
          });
          if (r.sourceId.startsWith("WALLET:")) {
            const walletKey = r.sourceId.slice("WALLET:".length);
            await adjustDriverWalletBalanceFs(walletKey, r.currency, -r.amount);
          }
        }}
      />

      <PaymentConfirmDialog
        open={openPaySupplier}
        onOpenChange={(v) => {
          setOpenPaySupplier(v);
          if (!v) setPaySupplierId(null);
        }}
        title="Thanh toán công nợ (Supplier)"
        description="Ghi nhận chi/hoàn công nợ thực tế vào Sổ thu chi."
        defaultCurrency={
          (() => {
            const row = congNoBySupplier.find((x) => x.supplierId === paySupplierId);
            const vnd = Math.round(row?.totalByCurrency.VND ?? 0);
            return (vnd !== 0 ? "VND" : "USD") as any;
          })()
        }
        defaultAmount={
          (() => {
            const row = congNoBySupplier.find((x) => x.supplierId === paySupplierId);
            if (!row) return undefined;
            const vnd = Math.round(row.totalByCurrency.VND ?? 0);
            const usd = Math.round(row.totalByCurrency.USD ?? 0);
            const thuVnd = Math.round(row.thuHoByCurrency.VND ?? 0);
            const thuUsd = Math.round(row.thuHoByCurrency.USD ?? 0);
            const key = supplierPaidKey(row.supplierId, cnMonth, cnYear);
            const paidVnd = Math.round(paidBySupplierCurrency.get(key)?.VND ?? 0);
            const paidUsd = Math.round(paidBySupplierCurrency.get(key)?.USD ?? 0);
            const netVnd = vnd - thuVnd - paidVnd;
            const netUsd = usd - thuUsd - paidUsd;
            const displayCur = vnd !== 0 ? "VND" : "USD";
            const net = displayCur === "VND" ? netVnd : netUsd;
            return net !== 0 ? Math.abs(net) : undefined;
          })()
        }
        onConfirm={async (r) => {
          if (!paySupplierId) return;
          const row = congNoBySupplier.find((x) => x.supplierId === paySupplierId);
          const s = paySupplierId !== "—" ? supplierById[paySupplierId] : undefined;
          const vnd = Math.round(row?.totalByCurrency.VND ?? 0);
          const usd = Math.round(row?.totalByCurrency.USD ?? 0);
          const thuVnd = Math.round(row?.thuHoByCurrency.VND ?? 0);
          const thuUsd = Math.round(row?.thuHoByCurrency.USD ?? 0);
          const key = supplierPaidKey(paySupplierId, cnMonth, cnYear);
          const paidVnd = Math.round(paidBySupplierCurrency.get(key)?.VND ?? 0);
          const paidUsd = Math.round(paidBySupplierCurrency.get(key)?.USD ?? 0);
          const netVnd = vnd - thuVnd - paidVnd;
          const netUsd = usd - thuUsd - paidUsd;
          const displayCur = vnd !== 0 ? "VND" : "USD";
          const net = displayCur === "VND" ? netVnd : netUsd;
          const direction = net < 0 ? "IN" : "OUT";

          await addCashbookEntryFs({
            direction,
            sourceId: r.sourceId,
            currency: r.currency as any,
            amount: r.amount,
            method: r.sourceId === "CASH" ? "TM" : "CK",
            content: `${direction === "OUT" ? "Chi" : "Hoàn"} công nợ • Supplier ${s?.name ?? paySupplierId} • ${String(cnMonth).padStart(2, "0")}/${cnYear}`,
            referenceType: "AP_SUPPLIER",
            referenceId: supplierPaidKey(paySupplierId, cnMonth, cnYear),
          });
          if (r.sourceId.startsWith("WALLET:")) {
            const walletKey = r.sourceId.slice("WALLET:".length);
            await adjustDriverWalletBalanceFs(walletKey, r.currency, direction === "OUT" ? -r.amount : r.amount);
          }
        }}
      />

      <Dialog
        open={openSupplierPdf}
        onOpenChange={(v) => {
          setOpenSupplierPdf(v);
          if (!v) {
            setSupplierPdfSupplierId(null);
            setSupplierPdfTitle("");
            setSupplierPdfError(null);
            setSupplierPdfBusy(false);
            setSupplierPdfUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return "";
            });
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>PDF công nợ</DialogTitle>
            <DialogDescription>{supplierPdfTitle || "—"}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <a
              href={supplierPdfUrl || "#"}
              download={`de-nghi-thanh-toan-supplier-${cnMonth}-${cnYear}.pdf`}
              className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900/40"
            >
              Lưu
            </a>
            <Button
              className="h-10 rounded-xl px-5 font-semibold text-white shadow-sm bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] hover:from-[#22B4EC] hover:to-[#0A6EA7]"
              onClick={async () => {
                try {
                  if (!supplierPdfUrl) return;
                  const res = await fetch(supplierPdfUrl);
                  const blob = await res.blob();
                  const file = new File([blob], `de-nghi-thanh-toan-supplier-${cnMonth}-${cnYear}.pdf`, {
                    type: "application/pdf",
                  });
                  const nav: any = navigator as any;
                  if (nav?.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
                    await nav.share({
                      title: "PDF đề nghị thanh toán",
                      text: supplierPdfTitle ? `Đề nghị thanh toán: ${supplierPdfTitle}` : "PDF đề nghị thanh toán",
                      files: [file],
                    });
                    return;
                  }
                } catch {
                  // fallthrough
                }
                try {
                  if (supplierPdfUrl) {
                    await navigator.clipboard.writeText(supplierPdfUrl);
                    alert("Đã copy file PDF (blob url) vào clipboard.");
                  }
                } catch {
                  // ignore
                }
              }}
            >
              Chia sẻ
            </Button>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            {supplierPdfBusy ? (
              <div className="p-4 text-sm text-zinc-600 dark:text-zinc-300">Đang tạo PDF…</div>
            ) : supplierPdfError ? (
              <div className="p-4 text-sm text-red-700">{supplierPdfError}</div>
            ) : supplierPdfUrl ? (
              <iframe title="PDF preview" src={supplierPdfUrl} className="h-[70vh] w-full" />
            ) : (
              <div className="p-4 text-sm text-zinc-600 dark:text-zinc-300">Chưa có PDF.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openPayrollPdf}
        onOpenChange={(v) => {
          setOpenPayrollPdf(v);
          if (!v) {
            setPayrollPdfTitle("");
            setPayrollPdfError(null);
            setPayrollPdfBusy(false);
            setPayrollPdfUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return "";
            });
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>PDF phiếu lương</DialogTitle>
            <DialogDescription>{payrollPdfTitle || "—"}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <a
              href={payrollPdfUrl || "#"}
              download={`phieu-luong-${selectedPayrollDriver?.employeeCode ?? "driver"}-${payrollFromIso}-${payrollToIso}.pdf`}
              className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900/40"
            >
              Lưu
            </a>
            <Button
              className="h-10 rounded-xl px-5 font-semibold text-white shadow-sm bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] hover:from-[#22B4EC] hover:to-[#0A6EA7]"
              onClick={async () => {
                try {
                  if (!payrollPdfUrl) return;
                  const res = await fetch(payrollPdfUrl);
                  const blob = await res.blob();
                  const file = new File([blob], `phieu-luong.pdf`, { type: "application/pdf" });
                  const nav: any = navigator as any;
                  if (nav?.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
                    await nav.share({
                      title: "PDF phiếu lương",
                      text: payrollPdfTitle ? `Phiếu lương: ${payrollPdfTitle}` : "PDF phiếu lương",
                      files: [file],
                    });
                    return;
                  }
                } catch {
                  // fallthrough
                }
                try {
                  if (payrollPdfUrl) {
                    await navigator.clipboard.writeText(payrollPdfUrl);
                    alert("Đã copy file PDF (blob url) vào clipboard.");
                  }
                } catch {
                  // ignore
                }
              }}
            >
              Chia sẻ
            </Button>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            {payrollPdfBusy ? (
              <div className="p-4 text-sm text-zinc-600 dark:text-zinc-300">Đang tạo PDF…</div>
            ) : payrollPdfError ? (
              <div className="p-4 text-sm text-red-700">{payrollPdfError}</div>
            ) : payrollPdfUrl ? (
              <iframe title="PDF preview" src={payrollPdfUrl} className="h-[70vh] w-full" />
            ) : (
              <div className="p-4 text-sm text-zinc-600 dark:text-zinc-300">Chưa có PDF.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {title}
          </div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {subtitle}
          </div>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  emphasize,
}: {
  label: string;
  value: string;
  strong?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className={strong ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-200"}>
        {label}
      </div>
      <div
        className={[
          "tabular-nums whitespace-nowrap",
          strong ? "font-semibold" : "font-medium",
          emphasize ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-200",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function OpButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      className="h-10 w-full text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
      variant="primary"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function OfficeCard({
  title,
  desc,
  button,
  onClick,
}: {
  title: string;
  desc: string;
  button: string;
  onClick: () => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="min-h-[56px]">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </div>
        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {desc}
        </div>
      </div>

      <div className="mt-auto flex justify-center pt-4">
        <Button
          className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
          variant="primary"
          onClick={onClick}
        >
          {button}
        </Button>
      </div>
    </div>
  );
}

function openOperating(
  t: OperatingExpenseType,
  setOpenOp: (v: boolean) => void,
  setOpType: (v: OperatingExpenseType) => void,
  setOpError: (v: string | null) => void,
  setOpForm: (v: { vehiclePlate: string; amountVnd: string; paymentMethod: OperatingPaymentMethod }) => void,
) {
  setOpType(t);
  setOpError(null);
  setOpForm({
    vehiclePlate: "",
    amountVnd: "",
    paymentMethod: "TM",
  });
  setOpenOp(true);
}

function EmptyCard() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm text-zinc-600 dark:text-zinc-300">
        Chưa có dữ liệu (demo).
      </div>
    </div>
  );
}

function computeDueDate(dmy: string) {
  // Legacy fallback (demo): ngày đi + 7 ngày
  const iso = dmyToIso(dmy);
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 7);
  return isoToDmy(toIsoDate(d));
}

function dueDateForSupplier(input: {
  serviceDateDmy: string;
  paymentType: "Phải Trả" | "Công Nợ";
  terms?: PartnerPaymentTerms;
}) {
  if (input.paymentType === "Phải Trả") {
    return dueDateNextDay(input.serviceDateDmy);
  }
  const t =
    input.terms?.mode === "MONTHLY"
      ? input.terms
      : { mode: "MONTHLY", payDay: 10, offsetMonths: 1 as const };
  return dueDateMonthly(input.serviceDateDmy, t.payDay, t.offsetMonths);
}

function dueDateNextDay(dmy: string) {
  const iso = dmyToIso(dmy);
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return isoToDmy(toIsoDate(d));
}

function dueDateMonthly(serviceDmy: string, payDay: number, offsetMonths: number) {
  const iso = dmyToIso(serviceDmy);
  if (!iso) return "—";
  const base = new Date(`${iso}T00:00:00`);
  const y = base.getFullYear();
  const m = base.getMonth();
  const target = new Date(y, m + offsetMonths, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(Math.max(Number(payDay) || 10, 1), lastDay);
  const out = new Date(target.getFullYear(), target.getMonth(), day);
  return isoToDmy(toIsoDate(out));
}

function dmyToIso(dmy: string) {
  const [d, m, y] = (dmy ?? "").split("/");
  if (!y || !m || !d) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function isoToDmy(iso: string) {
  const [y, m, d] = (iso ?? "").split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function toIsoDate(dt: Date) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function maxDate(dates: string[]) {
  const maxIso = dates
    .map(dmyToIso)
    .filter(Boolean)
    .sort()
    .at(-1);
  return maxIso ? isoToDmy(maxIso) : "";
}

function isInMonthYearDmy(dmy: string, month: number, year: number) {
  const [dd, mm, yyyy] = (dmy ?? "").split("/").map((x) => Number(x));
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return false;
  return yyyy === year && mm === month;
}

function yearChoices(currentYear: number) {
  const out: number[] = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) out.push(y);
  return out;
}

const PAID_FLAGS_KEY = "getdriver.finance.chi.paidflags.v1";

function readPaidFlags(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PAID_FLAGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePaidFlags(next: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PAID_FLAGS_KEY, JSON.stringify(next));
}

function paidFlagKeyBooking(code: string) {
  return `booking:${code}`;
}

function paidFlagKeySupplierMonth(supplierId: string, month: number, year: number) {
  return `supplier:${supplierId}:${String(month).padStart(2, "0")}/${year}`;
}

function supplierPaidKey(supplierId: string, month: number, year: number) {
  return `${supplierId}:${String(month).padStart(2, "0")}/${year}`;
}

function MoneyStack({
  vndLabel,
  usdLabel,
  vndNegative,
  usdNegative,
}: {
  vndLabel: string;
  usdLabel: string;
  vndNegative?: boolean;
  usdNegative?: boolean;
}) {
  return (
    <div className="grid grid-rows-2 items-center justify-items-end gap-0.5 leading-tight">
      <div className={vndNegative ? "text-red-600 dark:text-red-400" : ""}>{vndLabel}</div>
      <div className={usdNegative ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}>
        {usdLabel}
      </div>
    </div>
  );
}

function formatMoneyMulti(
  by: Record<Currency, number>,
  dashWhenZero?: boolean,
) {
  const parts: string[] = [];
  if ((by.VND ?? 0) > 0) parts.push(`${Math.round(by.VND).toLocaleString("vi-VN")} VND`);
  if ((by.USD ?? 0) > 0) parts.push(`${Math.round(by.USD).toLocaleString("en-US")} USD`);
  if (parts.length === 0) return dashWhenZero ? "—" : "0";
  return parts.join(" • ");
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function firstDayOfMonthIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function isoToDmy2(iso: string) {
  const [y, m, d] = (iso ?? "").split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

function isoToTs(iso: string) {
  // iso: yyyy-mm-dd
  const [y, m, d] = (iso ?? "").split("-");
  if (!y || !m || !d) return Number.NaN;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.getTime();
}

function dmyToTs(dmy: string) {
  // dmy: dd/mm/yyyy
  const [d, m, y] = (dmy ?? "").split("/");
  if (!y || !m || !d) return Number.NaN;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.getTime();
}

async function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let t: any;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(message)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
}

