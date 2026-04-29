"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { Input } from "@/components/ui/input";
import {
  ensureDriverWalletStore,
  ensureWalletsForAllRosterDrivers,
  listDriverWallets,
  type DriverWallet,
} from "@/lib/fleet/driverWalletStore";
import { ensureDriverStore, listDrivers } from "@/lib/fleet/driverStore";
import type { Reservation } from "@/lib/reservations/reservationStore";
import { subscribeActiveReservations } from "@/lib/reservations/reservationsFirestore";

type SourceFilter = "all" | "roster" | "dispatch";

type WalletRow = DriverWallet & {
  displayPhone: string;
  displayPlate: string;
};

export default function FinanceViTaiXePage() {
  const [q, setQ] = React.useState("");
  const [source, setSource] = React.useState<SourceFilter>("all");
  const [rows, setRows] = React.useState<WalletRow[]>([]);
  const [reservations, setReservations] = React.useState<Reservation[]>([]);

  const load = React.useCallback(() => {
    ensureDriverStore();
    ensureDriverWalletStore();
    ensureWalletsForAllRosterDrivers();

    const drivers = listDrivers();
    const driverByCode = new Map(drivers.map((d) => [d.employeeCode, d]));

    const wallets = listDriverWallets();
    const enriched: WalletRow[] = wallets.map((w) => {
      if (w.source === "roster" && w.employeeCode) {
        const dr = driverByCode.get(w.employeeCode);
        return {
          ...w,
          displayPhone: dr?.phone ?? "—",
          displayPlate: dr?.vehiclePlate ?? "—",
        };
      }
      return {
        ...w,
        displayPhone: w.phone ?? "—",
        displayPlate: w.plate ?? "—",
      };
    });

    enriched.sort((a, b) => {
      const byName = a.driverName.localeCompare(b.driverName, "vi");
      if (byName !== 0) return byName;
      return a.walletName.localeCompare(b.walletName);
    });

    setRows(enriched);
  }, []);

  React.useEffect(() => {
    load();
    const unsub = subscribeActiveReservations(setReservations);

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (
        e.key.includes("getdriver.fleet.driverWallets") ||
        e.key.includes("getdriver.fleet.drivers")
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
    const hay = (w: WalletRow) =>
      `${w.walletName} ${w.driverName} ${w.displayPhone} ${w.displayPlate} ${w.employeeCode ?? ""}`.toLowerCase();
    return rows.filter((w) => {
      if (source === "roster" && w.source !== "roster") return false;
      if (source === "dispatch" && w.source !== "dispatch") return false;
      if (!q.trim()) return true;
      return hay(w).includes(q.trim().toLowerCase());
    });
  }, [rows, q, source]);

  const totals = React.useMemo(() => {
    const sum = filtered.reduce((s, w) => s + (w.balances?.VND || 0), 0);
    return { count: filtered.length, sumVnd: sum };
  }, [filtered]);

  const viTaiXeBookings = reservations.filter((r) => r.paymentType === "Ví tài xế");

  return (
    <AppShell>
      <div className="flex-1 px-6 pb-10">
        <div className="pt-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Ví tài xế
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Danh sách tất cả ví (tài xế danh bạ và tài xế điều xe ngoài), số dư theo từng loại tiền.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Tổng ví</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {rows.length}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Đang hiển thị</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {totals.count}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40">
              <div className="text-xs text-emerald-800 dark:text-emerald-200/90">
                Tổng số dư (theo bộ lọc)
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">
                {totals.sumVnd.toLocaleString("vi-VN")} VND
              </div>
            </div>
          </div>

          <div className="mt-5 max-w-2xl space-y-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên ví, tài xế, SĐT, biển, mã NV…"
              className="w-full"
            />
            <div className="flex w-full flex-wrap items-stretch gap-1 sm:flex-nowrap">
              <div className="inline-flex min-h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:max-w-xl">
                {(
                  [
                    ["all", "All"],
                    ["roster", "Inhouse-Driver"],
                    ["dispatch", "Supplier-Driver"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSource(id)}
                    className={`inline-flex min-h-8 flex-1 items-center justify-center whitespace-nowrap rounded-md px-2 py-2 text-xs font-medium sm:px-3 sm:text-sm ${
                      source === id
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                        : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2">STT</th>
                  <th className="whitespace-nowrap px-3 py-2">Tên ví</th>
                  <th className="whitespace-nowrap px-3 py-2">Tên tài xế</th>
                  <th className="whitespace-nowrap px-3 py-2">Mã NV</th>
                  <th className="whitespace-nowrap px-3 py-2">SĐT</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right">Số dư ví</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {filtered.map((w, idx) => (
                  <tr key={w.key} className="bg-white dark:bg-zinc-950">
                    <td className="whitespace-nowrap px-3 py-2.5 text-zinc-500">{idx + 1}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-medium text-zinc-900 dark:text-zinc-50">
                      {w.walletName}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-zinc-900 dark:text-zinc-50">
                      {w.driverName}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {w.employeeCode ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{w.displayPhone}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-50">
                      <div className="flex flex-col items-end gap-0.5">
                        {formatBalancesList(w.balances).map((x) => (
                          <div key={x.label} className="whitespace-nowrap tabular-nums">
                            {x.label}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-zinc-500">
                      {rows.length === 0
                        ? "Chưa có ví tài xế. Thêm tài xế hoặc điều xe ngoài để tạo ví."
                        : "Không có dòng phù hợp bộ lọc / tìm kiếm."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Booking thanh toán qua ví
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Các đặt chỗ đang dùng hình thức <span className="font-medium">Ví tài xế</span> (đồng bộ từ
              Reservation).
            </p>
            <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              Hiện có{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                {viTaiXeBookings.length}
              </span>{" "}
              booking gắn ví (chi tiết giao dịch có thể mở rộng sau).
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function formatBalancesList(balances: Record<string, number> | undefined) {
  const b = balances ?? {};
  const rows: Array<{ cur: string; amt: number }> = [];
  rows.push({ cur: "VND", amt: Number(b["VND"] ?? 0) || 0 });
  for (const [curRaw, amtRaw] of Object.entries(b)) {
    const cur = String(curRaw || "").trim().toUpperCase();
    if (!cur || cur === "VND") continue;
    const amt = Number(amtRaw ?? 0) || 0;
    rows.push({ cur, amt });
  }
  return rows.map((x) => ({
    label:
      x.cur === "VND"
        ? `${x.amt.toLocaleString("vi-VN")} VND`
        : `${x.amt.toLocaleString("en-US")} ${x.cur}`,
  }));
}
