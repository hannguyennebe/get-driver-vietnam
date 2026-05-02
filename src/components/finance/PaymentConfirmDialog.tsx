"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPaymentInfo } from "@/lib/admin/paymentStore";
import type { DriverWallet } from "@/lib/fleet/driverWalletStore";
import { subscribeDriverWallets } from "@/lib/fleet/driverWalletsFirestore";
import { listCashbookEntries } from "@/lib/finance/cashbookStore";

export type PaymentSourceKind = "CASH" | "BANK_VAT_VND" | "BANK_NOVAT_VND" | "BANK_USD" | "WALLET";
export type PaymentCurrency = string; // "VND" | "USD" | "AUD" | ...

export type PaymentConfirmResult = {
  sourceId: string; // CASH / VAT_VND / NOVAT_VND / USD / WALLET:<walletKey>
  currency: PaymentCurrency;
  amount: number;
};

export function PaymentConfirmDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  defaultCurrency: PaymentCurrency;
  lockCurrencyTo?: PaymentCurrency;
  defaultAmount?: number;
  onConfirm: (r: PaymentConfirmResult) => void | Promise<void>;
}) {
  const payBtnClass =
    "h-10 rounded-xl px-5 font-semibold text-white shadow-sm " +
    "bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] " +
    "hover:from-[#22B4EC] hover:to-[#0A6EA7] " +
    "active:from-[#169BCF] active:to-[#096596] disabled:opacity-60";
  const earthBtnClass =
    "h-10 rounded-xl px-5 font-semibold text-zinc-900 shadow-sm " +
    "bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] " +
    "hover:from-[#EBCB7A] hover:to-[#B98A1F] " +
    "active:from-[#DDBA5D] active:to-[#A87912] disabled:opacity-60";
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [source, setSource] = React.useState<PaymentSourceKind>("CASH");
  const [walletKey, setWalletKey] = React.useState<string>("");
  const [currency, setCurrency] = React.useState<PaymentCurrency>(props.defaultCurrency);
  const [otherCurrency, setOtherCurrency] = React.useState<string>("");
  const [amount, setAmount] = React.useState<string>(props.defaultAmount != null ? String(props.defaultAmount) : "");

  const paymentInfo = React.useMemo(() => (typeof window === "undefined" ? null : getPaymentInfo()), []);
  const [wallets, setWallets] = React.useState<DriverWallet[]>([]);

  React.useEffect(() => {
    const unsub = subscribeDriverWallets(setWallets);
    return () => unsub();
  }, []);
  const walletOptions = React.useMemo(() => {
    const roster = wallets.filter((w) => w.source === "roster");
    const dispatch = wallets.filter((w) => w.source === "dispatch");
    const byName = (a: any, b: any) => String(a.walletName || "").localeCompare(String(b.walletName || ""));
    roster.sort(byName);
    dispatch.sort(byName);
    return { roster, dispatch };
  }, [wallets]);
  const cashBalances = React.useMemo(() => {
    if (typeof window === "undefined") return {} as Record<string, number>;
    const rows = listCashbookEntries().filter((e) => e.sourceId === "CASH");
    const m: Record<string, number> = {};
    for (const e of rows) {
      const cur = String(e.currency || "VND").trim().toUpperCase() || "VND";
      const delta = (e.direction === "IN" ? 1 : -1) * (Number(e.amount ?? 0) || 0);
      m[cur] = (m[cur] ?? 0) + delta;
    }
    return m;
  }, [props.open]);

  React.useEffect(() => {
    if (!props.open) return;
    setError(null);
    setBusy(false);
    setCurrency(props.lockCurrencyTo ?? props.defaultCurrency);
    setOtherCurrency("");
    setAmount(props.defaultAmount != null ? String(props.defaultAmount) : "");
    // reset wallet select when opening
    setWalletKey(walletOptions.roster[0]?.key ?? walletOptions.dispatch[0]?.key ?? "");
  }, [props.open, props.defaultCurrency, props.lockCurrencyTo, props.defaultAmount, walletOptions]);

  const sourceLockedCurrency: PaymentCurrency | null = React.useMemo(() => {
    if (source === "BANK_USD") return "USD";
    if (source === "BANK_VAT_VND" || source === "BANK_NOVAT_VND") return "VND";
    return props.lockCurrencyTo ?? null;
  }, [source, props.lockCurrencyTo]);

  const allowedCurrencies: PaymentCurrency[] = React.useMemo(() => {
    if (sourceLockedCurrency) return [sourceLockedCurrency];
    if (source === "CASH") {
      const keys = Object.keys(cashBalances ?? {})
        .map((x) => String(x || "").trim().toUpperCase())
        .filter(Boolean);
      const pos = keys.filter((k) => (Number((cashBalances as any)?.[k] ?? 0) || 0) > 0);
      return pos;
    }
    if (source === "WALLET") {
      const w = wallets.find((x) => x.key === walletKey);
      const b = w?.balances ?? {};
      const keys = Object.keys(b)
        .map((x) => String(x || "").trim().toUpperCase())
        .filter(Boolean);
      // Luôn cho chọn loại tiền có trong ví (kể cả số dư 0); kiểm tra đủ tiền lúc bấm Xác nhận.
      if (keys.length > 0) return keys;
      return ["VND"];
    }
    return ["VND", "USD", "OTHER"];
  }, [source, sourceLockedCurrency, cashBalances, wallets, walletKey]);

  React.useEffect(() => {
    if (!props.open) return;
    if (sourceLockedCurrency) {
      setCurrency(sourceLockedCurrency);
      return;
    }
    const cur = String(currency || "").trim().toUpperCase();
    const allowed = allowedCurrencies.map((x) => String(x || "").trim().toUpperCase());
    if (!allowed.includes(cur)) {
      setCurrency(allowedCurrencies[0] ?? "");
      setOtherCurrency("");
    }
  }, [props.open, source, walletKey, sourceLockedCurrency, allowedCurrencies, currency]);

  const effectiveCurrency: PaymentCurrency = React.useMemo(() => {
    if (sourceLockedCurrency) return sourceLockedCurrency;
    const cur = (currency || "").trim().toUpperCase();
    if (cur === "OTHER") {
      return (otherCurrency || "").trim().toUpperCase();
    }
    return cur || "VND";
  }, [currency, otherCurrency, sourceLockedCurrency]);

  const sourceId = React.useMemo(() => {
    if (source === "CASH") return "CASH";
    if (source === "BANK_VAT_VND") return "VAT_VND";
    if (source === "BANK_NOVAT_VND") return "NOVAT_VND";
    if (source === "BANK_USD") return "USD";
    return walletKey ? `WALLET:${walletKey}` : "WALLET:";
  }, [source, walletKey]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">Nguồn tiền</div>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
              value={source}
              onChange={(e) => {
                const v = e.target.value as PaymentSourceKind;
                setSource(v);
                if (v === "BANK_USD") setCurrency("USD");
                if (v === "BANK_VAT_VND" || v === "BANK_NOVAT_VND") setCurrency("VND");
              }}
            >
              <option value="CASH">TM (Tiền mặt)</option>
              <option value="BANK_VAT_VND">
                TK VAT - VND {paymentInfo?.vatVnd.bankName ? `• ${paymentInfo.vatVnd.bankName}` : ""}
              </option>
              <option value="BANK_NOVAT_VND">
                TK No VAT - VND {paymentInfo?.noVatVnd.bankName ? `• ${paymentInfo.noVatVnd.bankName}` : ""}
              </option>
              <option value="BANK_USD">
                TK USD {paymentInfo?.usd.bankName ? `• ${paymentInfo.usd.bankName}` : ""}
              </option>
              <option value="WALLET">Ví tài xế</option>
            </select>
          </div>

          {source === "WALLET" ? (
            <div className="space-y-1">
              <div className="text-sm font-medium">Tài khoản ví tài xế</div>
              <select
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                value={walletKey}
                onChange={(e) => setWalletKey(e.target.value)}
              >
                <option value="" disabled>
                  ---company---
                </option>
                {walletOptions.roster.map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.walletName} • {w.driverName} • {formatBalances(w.balances)}
                  </option>
                ))}
                <option value="" disabled>
                  ---supplier---
                </option>
                {walletOptions.dispatch.map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.walletName} • {w.driverName} • {formatBalances(w.balances)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm font-medium">Loại tiền</div>
              <select
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
                value={currency}
                disabled={
                  !!sourceLockedCurrency ||
                  ((source === "CASH" || source === "WALLET") && allowedCurrencies.length === 0)
                }
                onChange={(e) => setCurrency(e.target.value as PaymentCurrency)}
              >
                {allowedCurrencies.length === 0 ? (
                  <option value="">—</option>
                ) : (
                  allowedCurrencies.map((c) => {
                    const v = String(c || "").trim().toUpperCase();
                    if (!v) return null;
                    if (v === "OTHER")
                      return (
                        <option key="OTHER" value="OTHER">
                          Khác…
                        </option>
                      );
                    return (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    );
                  })
                )}
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Số tiền</div>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </div>
          </div>

          {!sourceLockedCurrency && String(currency).toUpperCase() === "OTHER" ? (
            <div className="space-y-1">
              <div className="text-sm font-medium">Mã tiền tệ (ví dụ: AUD)</div>
              <Input
                value={otherCurrency}
                onChange={(e) => setOtherCurrency(e.target.value.toUpperCase())}
                placeholder="AUD"
              />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button className={earthBtnClass} onClick={() => props.onOpenChange(false)} disabled={busy}>
              Huỷ
            </Button>
            <Button
              className={payBtnClass}
              disabled={busy}
              onClick={async () => {
                setError(null);
                const num = Number(String(amount).replace(/[^\d.]/g, ""));
                if (!Number.isFinite(num) || num <= 0) return setError("Số tiền không hợp lệ.");
                if (source === "WALLET" && !walletKey) return setError("Vui lòng chọn ví tài xế.");
                if (source === "CASH" && allowedCurrencies.length === 0) {
                  return setError("Tiền mặt không có số dư dương để thanh toán.");
                }
                const cur = (effectiveCurrency || "").trim().toUpperCase();
                if (!cur) return setError("Vui lòng chọn loại tiền.");
                if (source === "WALLET" && walletKey) {
                  const w = wallets.find((x) => x.key === walletKey);
                  const bal = Number((w?.balances as any)?.[cur] ?? 0) || 0;
                  if (num > bal) {
                    return setError("Số dư ví không đủ cho loại tiền đã chọn.");
                  }
                }
                if (String(currency).toUpperCase() === "OTHER" && cur.length < 3) {
                  return setError("Mã tiền tệ không hợp lệ.");
                }
                setBusy(true);
                try {
                  await props.onConfirm({ sourceId, currency: cur, amount: num });
                  props.onOpenChange(false);
                } catch (e) {
                  const msg = String((e as any)?.message ?? e ?? "unknown");
                  setError(msg || "Không thể ghi nhận thanh toán. Vui lòng thử lại.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Đang lưu…" : "Xác nhận"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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

