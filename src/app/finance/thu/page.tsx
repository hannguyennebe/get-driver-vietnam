"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import {
  type Currency,
  type Reservation,
} from "@/lib/reservations/reservationStore";
import { subscribeActiveReservations } from "@/lib/reservations/reservationsFirestore";
import type { TravelAgent } from "@/lib/data/partnersStore";
import { subscribeTravelAgents } from "@/lib/data/partnersFirestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type PartnerPaymentTerms } from "@/lib/data/partnersStore";
import type { ThuHoPayment } from "@/lib/finance/thuHoReportStore";
import { ThuHoTransactionDialog } from "@/components/finance/ThuHoTransactionDialog";
import type { CashbookEntry } from "@/lib/finance/cashbookStore";
import { addCashbookEntryFs, subscribeCashbookEntries } from "@/lib/finance/cashbookFirestore";
import { addThuHoPaymentFs, subscribeThuHoPayments } from "@/lib/finance/thuHoFirestore";
import { adjustDriverWalletBalanceFs } from "@/lib/fleet/driverWalletsFirestore";
import { getDemoSession } from "@/lib/auth/demo";
import { undoThuHoBookingFs } from "@/lib/finance/undoThuHoBooking";
// PDF is generated server-side (avoid fontkit browser crashes)

export default function FinanceThuPage() {
  const payBtnClass =
    "h-10 rounded-xl px-5 font-semibold text-white shadow-sm " +
    "bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] " +
    "hover:from-[#22B4EC] hover:to-[#0A6EA7] " +
    "active:from-[#169BCF] active:to-[#096596] disabled:opacity-60";
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [travelAgentById, setTravelAgentById] = React.useState<
    Record<string, TravelAgent>
  >({});
  const [thuHoPayments, setThuHoPayments] = React.useState<ThuHoPayment[]>([]);
  const [cashbook, setCashbook] = React.useState<CashbookEntry[]>([]);

  const [openDetail, setOpenDetail] = React.useState(false);
  const [detailAgentId, setDetailAgentId] = React.useState<string | null>(null);

  const [thuHoBookingCode, setThuHoBookingCode] = React.useState<string | null>(null);
  const [thuHoForm, setThuHoForm] = React.useState({
    amount: "",
    currency: "VND" as Currency,
  });
  const [openPayConfirm, setOpenPayConfirm] = React.useState(false);
  /** Thu tiền theo booking — Phải Thu hoặc Công nợ (sổ IN). */
  const [openBookingThuTien, setOpenBookingThuTien] = React.useState(false);
  const [bookingThuTienCode, setBookingThuTienCode] = React.useState<string | null>(null);
  const [openArAgentPay, setOpenArAgentPay] = React.useState(false);
  const [arAgentId, setArAgentId] = React.useState<string | null>(null);
  const [cnYear, setCnYear] = React.useState(() => new Date().getFullYear());
  const [cnMonth, setCnMonth] = React.useState(() => new Date().getMonth() + 1); // 1..12
  const [paidFlags, setPaidFlags] = React.useState<Record<string, boolean>>({});
  const [openAgentPdf, setOpenAgentPdf] = React.useState(false);
  const [agentPdfTitle, setAgentPdfTitle] = React.useState<string>("");
  const [agentPdfUrl, setAgentPdfUrl] = React.useState<string>("");
  const [agentPdfBusy, setAgentPdfBusy] = React.useState(false);
  const [agentPdfError, setAgentPdfError] = React.useState<string | null>(null);
  const [agentPdfAgentId, setAgentPdfAgentId] = React.useState<string | null>(null);
  const [undoBusyCode, setUndoBusyCode] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPaidFlags(readPaidFlags());
    const unsubR = subscribeActiveReservations(setReservations);
    const unsubTa = subscribeTravelAgents((tas) =>
      setTravelAgentById(Object.fromEntries(tas.map((x) => [x.id, x]))),
    );
    const unsubThuHo = subscribeThuHoPayments(setThuHoPayments);
    const unsubCb = subscribeCashbookEntries(setCashbook);
    return () => {
      unsubR();
      unsubTa();
      unsubThuHo();
      unsubCb();
    };
  }, []);

  React.useEffect(() => {
    if (!openAgentPdf) return;
    if (!agentPdfAgentId) return;
    setAgentPdfBusy(true);
    setAgentPdfError(null);
    (async () => {
      const agentId = agentPdfAgentId;
      const ta = agentId !== "—" ? travelAgentById[agentId] : undefined;
      const title = ta?.name ?? "Travel Agent";
      const rows = reservations
        .filter((r) => r.paymentType === "Công Nợ")
        .filter((r) => isInMonthYearDmy(r.date, cnMonth, cnYear))
        .filter((r) => (r.travelAgentId ?? "—") === agentId)
        .sort((a, b) => tripKeyDmy(a.date, a.time) - tripKeyDmy(b.date, b.time))
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
        fetch("/api/agent-statement-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyName: "Get Driver in Vietnam",
            createdDate: new Date().toLocaleDateString("vi-VN"),
            agentName: title,
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
      setAgentPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setAgentPdfTitle(title);
    })()
      .catch((e) => setAgentPdfError(String(e?.message ?? e)))
      .finally(() => setAgentPdfBusy(false));

    return () => {
      // keep url; revoked on next generation or unmount
    };
  }, [openAgentPdf, agentPdfAgentId, reservations, travelAgentById, cnMonth, cnYear]);

  const phaiThu = reservations.filter((r) => r.paymentType === "Phải Thu");
  const congNo = reservations
    .filter((r) => r.paymentType === "Công Nợ")
    .filter((r) => isInMonthYearDmy(r.date, cnMonth, cnYear));
  const thuHoBookings = reservations.filter((r) => (Number(r.thuHoAmount ?? 0) || 0) > 0);

  const receivedByBookingCurrency = React.useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const e of cashbook) {
      if (e.referenceType !== "AR") continue;
      if (e.direction !== "IN" && e.direction !== "OUT") continue;
      const code = String(e.referenceId || "");
      if (!code) continue;
      const cur = String(e.currency || "VND").trim().toUpperCase() || "VND";
      const curr = m.get(code) ?? {};
      curr[cur] = (curr[cur] ?? 0) + (Number(e.amount ?? 0) || 0);
      m.set(code, curr);
    }
    return m;
  }, [cashbook]);

  const receivedByAgentCurrency = React.useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    // Ghi nhận trực tiếp theo Travel Agent (thu từ đại lý)
    for (const e of cashbook) {
      if (e.referenceType !== "AR_AGENT") continue;
      if (e.direction !== "IN") continue;
      const agentId = String(e.referenceId || "");
      if (!agentId) continue;
      const cur = String(e.currency || "VND").trim().toUpperCase() || "VND";
      const curr = m.get(agentId) ?? {};
      curr[cur] = (curr[cur] ?? 0) + (Number(e.amount ?? 0) || 0);
      m.set(agentId, curr);
    }
    // Booking-level receipts rolled up to agent
    for (const e of cashbook) {
      if (e.referenceType !== "AR") continue;
      if (e.direction !== "IN" && e.direction !== "OUT") continue;
      const code = String(e.referenceId || "");
      if (!code) continue;
      const booking = reservations.find((x) => x.code === code);
      const agentId = booking?.travelAgentId ?? "";
      if (!agentId) continue;
      const cur = String(e.currency || "VND").trim().toUpperCase() || "VND";
      const curr = m.get(agentId) ?? {};
      curr[cur] = (curr[cur] ?? 0) + (Number(e.amount ?? 0) || 0);
      m.set(agentId, curr);
    }
    return m;
  }, [cashbook, reservations]);

  const thuHoRows = React.useMemo(() => {
    const paidByBooking = new Map<string, Record<Currency, number>>();
    for (const p of thuHoPayments) {
      const key = (p as any).bookingCode ?? ""; // backward-compat for older records
      if (!key) continue;
      const curr = paidByBooking.get(key) ?? { VND: 0, USD: 0 };
      curr[p.currency] = (curr[p.currency] ?? 0) + (Number(p.amount ?? 0) || 0);
      paidByBooking.set(key, curr);
    }

    const rows = thuHoBookings.map((r) => {
      const paid = paidByBooking.get(r.code) ?? { VND: 0, USD: 0 };
      const total: Record<Currency, number> = { VND: 0, USD: 0 };
      const cur = r.thuHoCurrency ?? "VND";
      total[cur] = Number(r.thuHoAmount ?? 0) || 0;
      const paidTotal = (paid.VND ?? 0) + (paid.USD ?? 0);
      return { booking: r, total, paidTotal };
    });

    rows.sort((a, b) => tripKeyDmy(b.booking.date, b.booking.time) - tripKeyDmy(a.booking.date, a.booking.time));
    return rows;
  }, [thuHoBookings, thuHoPayments]);

  const congNoByAgent = React.useMemo(() => {
    const m = new Map<
      string,
      { agentId: string; totalByCurrency: Record<Currency, number>; thuHoByCurrency: Record<Currency, number>; bookings: Reservation[] }
    >();
    for (const r of congNo) {
      const agentId = r.travelAgentId ?? "—";
      const cur = r.currency ?? "VND";
      const thuCur = r.thuHoCurrency ?? "VND";
      const entry =
        m.get(agentId) ??
        {
          agentId,
          totalByCurrency: { VND: 0, USD: 0 },
          thuHoByCurrency: { VND: 0, USD: 0 },
          bookings: [],
        };
      entry.totalByCurrency[cur] += Number(r.amount ?? 0) || 0;
      entry.thuHoByCurrency[thuCur] += Number(r.thuHoAmount ?? 0) || 0;
      entry.bookings.push(r);
      m.set(agentId, entry);
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
            Thu
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Tổng hợp các khoản phải thu và công nợ (demo).
          </p>

          <div className="mt-5 grid gap-6">
            <Section
              title="Các Khoản Phải Thu"
              subtitle="Lấy từ booking có hình thức thanh toán là Phải Thu"
            >
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                    <tr>
                      <th className="px-3 py-2">Travel Agent</th>
                      <th className="px-3 py-2">Tên Khách</th>
                      <th className="px-3 py-2">Ngày đi</th>
                      <th className="px-3 py-2">Giờ đi</th>
                      <th className="px-3 py-2">Hành Trình</th>
                      <th className="px-3 py-2 text-right">Số Tiền</th>
                      <th className="px-3 py-2 text-right">Thu Hộ</th>
                      <th className="px-3 py-2">Hạn Thanh Toán</th>
                      <th className="px-3 py-2 text-right">Thu tiền</th>
                      <th className="px-3 py-2 text-center">
                        <span className="block">Đã chi đủ</span>
                        <span className="block text-[10px] font-normal text-zinc-500">Hoàn tác: Admin</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {phaiThu.map((r) => {
                      const isAdmin = getDemoSession()?.role === "Admin";
                      const ta = r.travelAgentId ? travelAgentById[r.travelAgentId] : undefined;
                      const cur = String(r.currency || "VND").trim().toUpperCase() || "VND";
                      const total = Number(r.amount ?? 0) || 0;
                      const received = receivedByBookingCurrency.get(r.code)?.[cur] ?? 0;
                      const remaining = Math.max(total - received, 0);
                      const flagKey = paidFlagKeyBooking(r.code);
                      const forcedPaid = Boolean(paidFlags[flagKey]);
                      return (
                        <tr key={r.code} className="bg-white dark:bg-zinc-950">
                          <td className="px-3 py-2">{ta?.name ?? "—"}</td>
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
                            {r.paymentType === "Ví tài xế"
                              ? "—"
                              : dueDateForAgent({
                                  serviceDateDmy: r.date,
                                  paymentType: r.paymentType,
                                  terms: r.travelAgentId
                                    ? travelAgentById[r.travelAgentId]?.paymentTerms
                                    : undefined,
                                })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              className={`${payBtnClass} ${forcedPaid ? "opacity-40" : ""}`}
                              disabled={forcedPaid || remaining <= 0}
                              onClick={() => {
                                setBookingThuTienCode(r.code);
                                setOpenBookingThuTien(true);
                              }}
                              title={
                                forcedPaid
                                  ? "Đã đánh dấu đã chi đủ"
                                  : remaining > 0
                                    ? `Còn lại: ${remaining.toLocaleString("vi-VN")} ${cur}`
                                    : "Đã thu đủ"
                              }
                            >
                              Thu Tiền
                            </Button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {!forcedPaid ? (
                              <input
                                type="checkbox"
                                checked={Boolean(paidFlags[flagKey])}
                                onChange={(e) => {
                                  const next = { ...paidFlags, [flagKey]: e.target.checked };
                                  setPaidFlags(next);
                                  writePaidFlags(next);
                                }}
                                title="Đánh dấu đã chi đủ (ẩn nút Thu tiền)"
                              />
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                className="h-9 rounded-lg border border-zinc-300 bg-white text-sm dark:border-zinc-600 dark:bg-zinc-950"
                                disabled={!isAdmin}
                                title={isAdmin ? "Hoàn tác: bỏ đánh dấu Đã chi đủ" : "Chỉ Admin mới hoàn tác được"}
                                onClick={() => {
                                  if (!isAdmin) return;
                                  if (!confirm("Bỏ đánh dấu Đã chi đủ cho dòng này?")) return;
                                  const next = { ...paidFlags };
                                  delete next[flagKey];
                                  setPaidFlags(next);
                                  writePaidFlags(next);
                                }}
                              >
                                Hoàn Tác
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {phaiThu.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">
                          Chưa có khoản phải thu.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              title="Công Nợ Phải Thu"
              subtitle="Gom theo Travel Agent, hiển thị doanh thu/thu hộ/phải thu(hoàn) theo từng loại tiền"
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
                      <th className="px-3 py-2">Travel Agent</th>
                      <th className="px-3 py-2 text-right">Doanh Thu</th>
                      <th className="px-3 py-2 text-right">Thu Hộ</th>
                      <th className="px-3 py-2 text-right">Phải Thu (Hoàn)</th>
                      <th className="px-3 py-2 text-right">Thu tiền</th>
                      <th className="px-3 py-2 text-center">
                        <span className="block">Đã chi đủ</span>
                        <span className="block text-[10px] font-normal text-zinc-500">Hoàn tác: Admin</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {congNoByAgent.map((row, idx) => {
                      const isAdminCn = getDemoSession()?.role === "Admin";
                      const ta = row.agentId !== "—" ? travelAgentById[row.agentId] : undefined;
                      const vnd = Math.round(row.totalByCurrency.VND ?? 0);
                      const usd = Math.round(row.totalByCurrency.USD ?? 0);
                      const thuVnd = Math.round(row.thuHoByCurrency.VND ?? 0);
                      const thuUsd = Math.round(row.thuHoByCurrency.USD ?? 0);
                      const receivedVnd = Math.round(receivedByAgentCurrency.get(row.agentId)?.VND ?? 0);
                      const receivedUsd = Math.round(receivedByAgentCurrency.get(row.agentId)?.USD ?? 0);
                      const netVnd = vnd - thuVnd - receivedVnd;
                      const netUsd = usd - thuUsd - receivedUsd;
                      const anyNet = netVnd !== 0 || netUsd !== 0;
                      const flagKey = paidFlagKeyAgentMonth(row.agentId, cnMonth, cnYear);
                      const forcedPaid = Boolean(paidFlags[flagKey]);
                      return (
                        <tr
                          key={row.agentId}
                          className="bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900/30 cursor-default"
                          onDoubleClick={() => {
                            setDetailAgentId(row.agentId);
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
                                setAgentPdfAgentId(row.agentId);
                                setOpenAgentPdf(true);
                              }}
                              title="Bấm để xem PDF"
                            >
                              {ta?.name ?? "—"}
                            </button>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{row.agentId}</div>
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
                              className={`${payBtnClass} ${forcedPaid ? "opacity-40" : ""}`}
                              disabled={forcedPaid || !anyNet || row.agentId === "—"}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setArAgentId(row.agentId);
                                setOpenArAgentPay(true);
                              }}
                              title={anyNet ? "Thu tiền công nợ phải thu" : "Không có số phải thu/phải hoàn"}
                            >
                              Thu Tiền
                            </Button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {!forcedPaid ? (
                              <input
                                type="checkbox"
                                checked={Boolean(paidFlags[flagKey])}
                                disabled={row.agentId === "—"}
                                onChange={(e) => {
                                  const next = { ...paidFlags, [flagKey]: e.target.checked };
                                  setPaidFlags(next);
                                  writePaidFlags(next);
                                }}
                                title="Đánh dấu đã chi đủ (ẩn nút Thu tiền)"
                              />
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                className="h-9 rounded-lg border border-zinc-300 bg-white text-sm dark:border-zinc-600 dark:bg-zinc-950"
                                disabled={!isAdminCn || row.agentId === "—"}
                                title={
                                  isAdminCn ? "Hoàn tác: bỏ đánh dấu Đã chi đủ" : "Chỉ Admin mới hoàn tác được"
                                }
                                onClick={() => {
                                  if (!isAdminCn) return;
                                  if (!confirm("Bỏ đánh dấu Đã chi đủ cho agent này (tháng đã chọn)?")) return;
                                  const next = { ...paidFlags };
                                  delete next[flagKey];
                                  setPaidFlags(next);
                                  writePaidFlags(next);
                                }}
                              >
                                Hoàn Tác
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {congNoByAgent.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                          Chưa có công nợ.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              title="Báo Cáo Thu Hộ"
              subtitle="Danh sách các booking có Thu Hộ và ghi nhận thanh toán"
            >
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                    <tr>
                      <th className="px-3 py-2">STT</th>
                      <th className="px-3 py-2">Travel Agent</th>
                      <th className="px-3 py-2">Tên khách</th>
                      <th className="px-3 py-2">Ngày đi</th>
                      <th className="px-3 py-2">Giờ đi</th>
                      <th className="px-3 py-2">Hành trình</th>
                      <th className="px-3 py-2 text-right">Số tiền thu hộ</th>
                      <th className="px-3 py-2 text-right">Thu Tiền</th>
                      <th className="px-3 py-2 text-center">
                        <span className="block">Đã Thu Đủ</span>
                        <span className="block text-[10px] font-normal text-zinc-500">Hoàn tác: Admin</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {thuHoRows.map((row, idx) => {
                      const r = row.booking;
                      const ta = r.travelAgentId ? travelAgentById[r.travelAgentId] : undefined;
                      const prefer: Currency = (r.thuHoCurrency ?? "VND") as Currency;
                      const remainAmt = Number(r.thuHoAmount ?? 0) || 0;
                      const disabled = remainAmt <= 0;
                      const flagKey = paidFlagKeyThuHo(r.code);
                      const forcedPaid = Boolean(paidFlags[flagKey]);
                      const isAdmin = getDemoSession()?.role === "Admin";

                      return (
                        <tr key={r.code} className="bg-white dark:bg-zinc-950">
                          <td className="px-3 py-2">{idx + 1}</td>
                          <td className="px-3 py-2">{ta?.name ?? "—"}</td>
                          <td className="px-3 py-2">{r.customerName}</td>
                          <td className="px-3 py-2">{r.date}</td>
                          <td className="px-3 py-2">{r.time}</td>
                          <td className="px-3 py-2">{r.itinerary || "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {forcedPaid
                              ? `0 ${prefer}`
                              : formatMoneyMulti(row.total, true)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              className={payBtnClass}
                              disabled={forcedPaid || disabled}
                              onClick={() => {
                                setThuHoBookingCode(r.code);
                                setThuHoForm({
                                  currency: prefer,
                                  amount: remainAmt > 0 ? String(remainAmt) : "",
                                });
                                setOpenPayConfirm(true);
                              }}
                            >
                              Thu Tiền
                            </Button>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {!forcedPaid ? (
                              <input
                                type="checkbox"
                                checked={Boolean(paidFlags[flagKey])}
                                onChange={(e) => {
                                  const next = { ...paidFlags, [flagKey]: e.target.checked };
                                  setPaidFlags(next);
                                  writePaidFlags(next);
                                }}
                                title="Đánh dấu đã thu đủ (hiển thị 0)"
                              />
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                className="h-9 rounded-lg border border-zinc-300 bg-white text-sm dark:border-zinc-600 dark:bg-zinc-950"
                                disabled={!isAdmin || undoBusyCode !== null}
                                title={
                                  isAdmin
                                    ? "Hoàn tác: xóa ghi nhận thu hộ trên server và bỏ đánh dấu"
                                    : "Chỉ Admin mới hoàn tác được"
                                }
                                onClick={() => {
                                  if (!isAdmin) return;
                                  if (
                                    !confirm(
                                      "Hoàn tác sẽ xóa toàn bộ ghi nhận Thu hộ cho booking này (sổ quỹ, báo cáo thu hộ, hoàn tiền ví nếu có). Tiếp tục?",
                                    )
                                  )
                                    return;
                                  void (async () => {
                                    setUndoBusyCode(r.code);
                                    try {
                                      await undoThuHoBookingFs(r.code, cashbook, thuHoPayments);
                                      const next = { ...paidFlags };
                                      delete next[flagKey];
                                      setPaidFlags(next);
                                      writePaidFlags(next);
                                    } catch (err) {
                                      window.alert(
                                        String((err as { message?: unknown })?.message ?? err ?? "Hoàn tác thất bại."),
                                      );
                                    } finally {
                                      setUndoBusyCode(null);
                                    }
                                  })();
                                }}
                              >
                                {undoBusyCode === r.code ? "Đang xử lý…" : "Hoàn Tác"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {thuHoRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">
                          Chưa có booking Thu Hộ.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Section>

          </div>
        </div>
      </div>

      <Dialog
        open={openDetail}
        onOpenChange={(v) => {
          setOpenDetail(v);
          if (!v) setDetailAgentId(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Bảng kê công nợ chi tiết</DialogTitle>
            <DialogDescription>
              {detailAgentId && detailAgentId !== "—"
                ? travelAgentById[detailAgentId]?.name ?? detailAgentId
                : "—"}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2">Tên Khách</th>
                  <th className="px-3 py-2">Ngày Đi</th>
                  <th className="px-3 py-2">Giờ Đi</th>
                  <th className="px-3 py-2">Điểm Đón</th>
                  <th className="px-3 py-2">Điểm Trả</th>
                  <th className="px-3 py-2 text-right">Số tiền</th>
                  <th className="px-3 py-2 text-right">Thu hộ</th>
                  <th className="px-3 py-2 text-right">Thu tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {detailAgentId
                  ? congNo.filter((r) => (r.travelAgentId ?? "—") === detailAgentId).map((r) => {
                      const cur = String(r.currency || "VND").trim().toUpperCase() || "VND";
                      const total = Number(r.amount ?? 0) || 0;
                      const received = receivedByBookingCurrency.get(r.code)?.[cur] ?? 0;
                      const remaining = Math.max(total - received, 0);
                      return (
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
                        <td className="px-3 py-2 text-right">
                          <Button
                            className={payBtnClass}
                            disabled={remaining <= 0}
                            onClick={() => {
                              setBookingThuTienCode(r.code);
                              setOpenBookingThuTien(true);
                              setOpenDetail(false);
                            }}
                            title={
                              remaining > 0
                                ? `Còn lại: ${remaining.toLocaleString("vi-VN")} ${cur}`
                                : "Đã thu đủ"
                            }
                          >
                            Thu Tiền
                          </Button>
                        </td>
                      </tr>
                      );
                    })
                  : null}

                {detailAgentId && congNo.filter((r) => (r.travelAgentId ?? "—") === detailAgentId).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                      Không có dữ liệu.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      <ThuHoTransactionDialog
        open={openPayConfirm}
        onOpenChange={(v) => {
          setOpenPayConfirm(v);
          if (!v) setThuHoBookingCode(null);
        }}
        defaultCurrency={(thuHoForm.currency ?? "VND") as any}
        defaultAmount={Number(String(thuHoForm.amount).replace(/[^\d.]/g, "")) || undefined}
        onConfirm={(r) => {
          if (!thuHoBookingCode) return;
          const booking = reservations.find((x) => x.code === thuHoBookingCode);
          const ta = booking?.travelAgentId ? travelAgentById[booking.travelAgentId] : undefined;

          // Persist payment record (thu hộ)
          void addThuHoPaymentFs({
            bookingCode: thuHoBookingCode,
            travelAgentId: booking?.travelAgentId || undefined,
            travelAgentName: ta?.name ?? undefined,
            currency: r.currency as any,
            amount: r.amount,
            method: r.sourceId === "CASH" ? "TM" : "CK",
          });

          // Cashbook entry: thu tiền vào nguồn đã chọn
          void addCashbookEntryFs({
            direction: "IN",
            sourceId: r.sourceId,
            currency: r.currency as any,
            amount: r.amount,
            method: r.sourceId === "CASH" ? "TM" : "CK",
            content: `Thu hộ • Booking ${thuHoBookingCode}`,
            referenceType: "ThuHo",
            referenceId: thuHoBookingCode,
          });

          // If wallet source: increase wallet balance
          if (r.sourceId.startsWith("WALLET:")) {
            const walletKey = r.sourceId.slice("WALLET:".length);
            // Thu vào ví = tăng số dư
            void adjustDriverWalletBalanceFs(walletKey, r.currency, r.amount);
          }
        }}
      />

      <ThuHoTransactionDialog
        open={openArAgentPay}
        onOpenChange={(v) => {
          setOpenArAgentPay(v);
          if (!v) setArAgentId(null);
        }}
        title="Thu tiền công nợ"
        description="Chọn quỹ tiền vào, loại tiền và số tiền — ghi nhận thu/hoàn công nợ Travel Agent. Thu tiền: không áp dụng kiểm tra số dư không đủ."
        fundSelectLabel="Lựa chọn quỹ tiền vào"
        confirmLabel="Thu Tiền"
        defaultCurrency={
          (() => {
            const row = congNoByAgent.find((x) => x.agentId === arAgentId);
            if (!row) return "VND" as any;
            const vnd = Math.round(row.totalByCurrency.VND ?? 0);
            return (vnd !== 0 ? "VND" : "USD") as any;
          })()
        }
        defaultAmount={
          (() => {
            const row = congNoByAgent.find((x) => x.agentId === arAgentId);
            if (!row) return undefined;
            const vnd = Math.round(row.totalByCurrency.VND ?? 0);
            const usd = Math.round(row.totalByCurrency.USD ?? 0);
            const thuVnd = Math.round(row.thuHoByCurrency.VND ?? 0);
            const thuUsd = Math.round(row.thuHoByCurrency.USD ?? 0);
            const receivedVnd = Math.round(receivedByAgentCurrency.get(row.agentId)?.VND ?? 0);
            const receivedUsd = Math.round(receivedByAgentCurrency.get(row.agentId)?.USD ?? 0);
            const netVnd = vnd - thuVnd - receivedVnd;
            const netUsd = usd - thuUsd - receivedUsd;
            const displayCur = vnd !== 0 ? "VND" : "USD";
            const net = displayCur === "VND" ? netVnd : netUsd;
            return net !== 0 ? Math.abs(net) : undefined;
          })()
        }
        onConfirm={(r) => {
          if (!arAgentId) return;
          const ta = arAgentId !== "—" ? travelAgentById[arAgentId] : undefined;
          const row = congNoByAgent.find((x) => x.agentId === arAgentId);
          const vnd = Math.round(row?.totalByCurrency.VND ?? 0);
          const usd = Math.round(row?.totalByCurrency.USD ?? 0);
          const thuVnd = Math.round(row?.thuHoByCurrency.VND ?? 0);
          const thuUsd = Math.round(row?.thuHoByCurrency.USD ?? 0);
          const receivedVnd = Math.round(receivedByAgentCurrency.get(arAgentId)?.VND ?? 0);
          const receivedUsd = Math.round(receivedByAgentCurrency.get(arAgentId)?.USD ?? 0);
          const netVnd = vnd - thuVnd - receivedVnd;
          const netUsd = usd - thuUsd - receivedUsd;
          const displayCur = vnd !== 0 ? "VND" : "USD";
          const net = displayCur === "VND" ? netVnd : netUsd;
          const direction = net < 0 ? "OUT" : "IN";

          void addCashbookEntryFs({
            direction,
            sourceId: r.sourceId,
            currency: r.currency as any,
            amount: r.amount,
            method: r.sourceId === "CASH" ? "TM" : "CK",
            content: `${direction === "IN" ? "Thu" : "Hoàn"} công nợ • Travel Agent ${ta?.name ?? arAgentId}`,
            referenceType: "AR_AGENT",
            referenceId: arAgentId,
          });
          if (r.sourceId.startsWith("WALLET:")) {
            const walletKey = r.sourceId.slice("WALLET:".length);
            void adjustDriverWalletBalanceFs(walletKey, r.currency, direction === "IN" ? r.amount : -r.amount);
          }
        }}
      />

      <ThuHoTransactionDialog
        open={openBookingThuTien}
        onOpenChange={(v) => {
          setOpenBookingThuTien(v);
          if (!v) setBookingThuTienCode(null);
        }}
        title="Thu tiền"
        description="Chọn quỹ tiền vào — ghi nhận thu booking (Phải Thu hoặc Công nợ). Thu tiền: không áp dụng kiểm tra số dư không đủ."
        fundSelectLabel="Lựa chọn quỹ tiền vào"
        confirmLabel="Thu Tiền"
        defaultCurrency={
          (() => {
            const booking = reservations.find((x) => x.code === bookingThuTienCode);
            return (String(booking?.currency || "VND").trim().toUpperCase() || "VND") as any;
          })()
        }
        defaultAmount={
          (() => {
            const booking = reservations.find((x) => x.code === bookingThuTienCode);
            if (!booking) return undefined;
            const cur = String(booking.currency || "VND").trim().toUpperCase() || "VND";
            const total = Number(booking.amount ?? 0) || 0;
            const received = receivedByBookingCurrency.get(booking.code)?.[cur] ?? 0;
            const remaining = Math.max(total - received, 0);
            return remaining > 0 ? remaining : undefined;
          })()
        }
        onConfirm={(r) => {
          if (!bookingThuTienCode) return;
          const booking = reservations.find((x) => x.code === bookingThuTienCode);
          const tag =
            booking?.paymentType === "Công Nợ" ? "Thu tiền công nợ" : "Thu tiền phải thu";
          void addCashbookEntryFs({
            direction: "IN",
            sourceId: r.sourceId,
            currency: r.currency as any,
            amount: r.amount,
            method: r.sourceId === "CASH" ? "TM" : "CK",
            content: `${tag} • Booking ${bookingThuTienCode}`,
            referenceType: "AR",
            referenceId: bookingThuTienCode,
          });

          if (r.sourceId.startsWith("WALLET:")) {
            const walletKey = r.sourceId.slice("WALLET:".length);
            void adjustDriverWalletBalanceFs(walletKey, r.currency, r.amount);
          }
        }}
      />

      <Dialog open={openAgentPdf} onOpenChange={setOpenAgentPdf}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>PDF công nợ</DialogTitle>
            <DialogDescription>{agentPdfTitle || "—"}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <a
              href={agentPdfUrl || "#"}
              download={`de-nghi-thanh-toan-${cnMonth}-${cnYear}.pdf`}
              className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900/40"
            >
              Lưu
            </a>
            <Button
              className="h-10 rounded-xl px-5 font-semibold text-white shadow-sm bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] hover:from-[#22B4EC] hover:to-[#0A6EA7]"
              onClick={async () => {
                try {
                  if (!agentPdfUrl) return;
                  const res = await fetch(agentPdfUrl);
                  const blob = await res.blob();
                  const file = new File([blob], `de-nghi-thanh-toan-${cnMonth}-${cnYear}.pdf`, {
                    type: "application/pdf",
                  });
                  const nav: any = navigator as any;
                  if (nav?.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
                    await nav.share({
                      title: "PDF đề nghị thanh toán",
                      text: agentPdfTitle ? `Đề nghị thanh toán: ${agentPdfTitle}` : "PDF đề nghị thanh toán",
                      files: [file],
                    });
                    return;
                  }
                } catch {
                  // fallthrough
                }
                try {
                  if (agentPdfUrl) {
                    await navigator.clipboard.writeText(agentPdfUrl);
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
            {agentPdfBusy ? (
              <div className="p-4 text-sm text-zinc-600 dark:text-zinc-300">Đang tạo PDF…</div>
            ) : agentPdfError ? (
              <div className="p-4 text-sm text-red-700">{agentPdfError}</div>
            ) : agentPdfUrl ? (
              <iframe title="PDF preview" src={agentPdfUrl} className="h-[70vh] w-full" />
            ) : (
              <div className="p-4 text-sm text-zinc-600 dark:text-zinc-300">Chưa có PDF.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function isInMonthYearDmy(dmy: string, month: number, year: number) {
  const [dd, mm, yyyy] = (dmy ?? "").split("/").map((x) => Number(x));
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return false;
  return yyyy === year && mm === month;
}

function yearChoices(currentYear: number) {
  // Show a small, useful range: currentYear-2 .. currentYear+1
  const out: number[] = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) out.push(y);
  return out;
}

const PAID_FLAGS_KEY = "getdriver.finance.thu.paidflags.v1";

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

function paidFlagKeyAgentMonth(agentId: string, month: number, year: number) {
  return `agent:${agentId}:${String(month).padStart(2, "0")}/${year}`;
}

function paidFlagKeyThuHo(bookingCode: string) {
  return `thuho:${bookingCode}`;
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

function computeDueDate(dmy: string) {
  // Legacy fallback (demo)
  const iso = dmyToIso(dmy);
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 7);
  return isoToDmy(toIsoDate(d));
}

function dueDateForAgent(input: {
  serviceDateDmy: string;
  paymentType: "Phải Thu" | "Công Nợ";
  terms?: PartnerPaymentTerms;
}) {
  if (input.paymentType === "Phải Thu") {
    return dueDateNextDay(input.serviceDateDmy);
  }
  // Công nợ
  const t = input.terms?.mode === "MONTHLY" ? input.terms : { mode: "MONTHLY", payDay: 10, offsetMonths: 1 };
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
  const m = base.getMonth(); // 0-based
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
  // dates are dd/mm/yyyy
  const maxIso = dates
    .map(dmyToIso)
    .filter(Boolean)
    .sort()
    .at(-1);
  return maxIso ? isoToDmy(maxIso) : "";
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

function tripKeyDmy(dateDmy: string, timeHm: string) {
  const [dd, mm, yyyy] = (dateDmy ?? "").split("/").map((x) => Number(x));
  const [hh, mi] = (timeHm ?? "").split(":").map((x) => Number(x));
  const y = Number.isFinite(yyyy) ? yyyy : 0;
  const m = Number.isFinite(mm) ? mm : 0;
  const d = Number.isFinite(dd) ? dd : 0;
  const h = Number.isFinite(hh) ? hh : 0;
  const n = Number.isFinite(mi) ? mi : 0;
  return (((y * 100 + m) * 100 + d) * 100 + h) * 100 + n;
}

