"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPaymentInfo, type PaymentInfo } from "@/lib/admin/paymentStore";
import type { DriverWallet } from "@/lib/fleet/driverWalletStore";
import { subscribeDriverWallets } from "@/lib/fleet/driverWalletsFirestore";
import {
  CASH_FUND_CURRENCY_OPTIONS,
  formatBalances,
  type PaymentConfirmResult,
  type PaymentCurrency,
} from "./paymentConfirmTypes";

type TopSource = "CASH" | "BANK" | "WALLET";
type BankSourceId = "VAT_VND" | "NOVAT_VND" | "USD";

function bankOptionsFromPaymentInfo(pi: PaymentInfo): Array<{ id: BankSourceId; label: string }> {
  return [
    {
      id: "VAT_VND",
      label: `${pi.vatVnd.bankName} • VND • ${pi.vatVnd.accountHolder}`,
    },
    {
      id: "NOVAT_VND",
      label: `${pi.noVatVnd.bankName} • VND • ${pi.noVatVnd.accountHolder}`,
    },
    {
      id: "USD",
      label: `${pi.usd.bankName} • USD • ${pi.usd.accountHolder}`,
    },
  ];
}

function currencyForBank(id: BankSourceId): PaymentCurrency {
  return id === "USD" ? "USD" : "VND";
}

export function ThuHoTransactionDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCurrency: PaymentCurrency;
  defaultAmount?: number;
  onConfirm: (r: PaymentConfirmResult) => void | Promise<void>;
  /** Mặc định: Thu tiền thu hộ */
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** Nhãn khối chọn quỹ (vd: công nợ TA) */
  fundSelectLabel?: string;
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
  const [topSource, setTopSource] = React.useState<TopSource>("CASH");
  const [bankId, setBankId] = React.useState<BankSourceId>("VAT_VND");
  const [walletKey, setWalletKey] = React.useState("");
  const [currency, setCurrency] = React.useState<PaymentCurrency>("VND");
  const [amount, setAmount] = React.useState("");

  const paymentInfo = React.useMemo(() => (typeof window === "undefined" ? null : getPaymentInfo()), []);
  const bankRows = React.useMemo(
    () => (paymentInfo ? bankOptionsFromPaymentInfo(paymentInfo) : []),
    [paymentInfo],
  );

  const [wallets, setWallets] = React.useState<DriverWallet[]>([]);
  React.useEffect(() => {
    const unsub = subscribeDriverWallets(setWallets);
    return () => unsub();
  }, []);

  const walletOptions = React.useMemo(() => {
    const roster = wallets.filter((w) => w.source === "roster");
    const dispatch = wallets.filter((w) => w.source === "dispatch");
    const byName = (a: DriverWallet, b: DriverWallet) =>
      String(a.walletName || "").localeCompare(String(b.walletName || ""));
    roster.sort(byName);
    dispatch.sort(byName);
    return { roster, dispatch };
  }, [wallets]);

  React.useEffect(() => {
    if (!props.open) return;
    setError(null);
    setBusy(false);
    setTopSource("CASH");
    setBankId("VAT_VND");
    const firstWallet = walletOptions.roster[0]?.key ?? walletOptions.dispatch[0]?.key ?? "";
    setWalletKey(firstWallet);
    const defCur = String(props.defaultCurrency || "VND").trim().toUpperCase();
    setCurrency(CASH_FUND_CURRENCY_OPTIONS.includes(defCur) ? defCur : "VND");
    setAmount(props.defaultAmount != null ? String(props.defaultAmount) : "");
  }, [props.open, props.defaultCurrency, props.defaultAmount, walletOptions]);

  const lockedCurrency = topSource === "BANK" ? currencyForBank(bankId) : null;

  React.useEffect(() => {
    if (!props.open) return;
    if (topSource === "BANK") {
      setCurrency(currencyForBank(bankId));
    }
  }, [props.open, topSource, bankId]);

  const allowedCurrencyList = React.useMemo(() => {
    if (topSource === "CASH") return CASH_FUND_CURRENCY_OPTIONS;
    if (topSource === "BANK") return [currencyForBank(bankId)];
    return CASH_FUND_CURRENCY_OPTIONS;
  }, [topSource, bankId]);

  React.useEffect(() => {
    if (!props.open) return;
    if (topSource !== "CASH" && topSource !== "WALLET") return;
    const cur = String(currency || "").trim().toUpperCase();
    if (!allowedCurrencyList.map((x) => String(x).toUpperCase()).includes(cur)) {
      setCurrency(allowedCurrencyList[0] ?? "VND");
    }
  }, [props.open, topSource, allowedCurrencyList, currency]);

  const sourceId = React.useMemo(() => {
    if (topSource === "CASH") return "CASH";
    if (topSource === "BANK") return bankId;
    return walletKey ? `WALLET:${walletKey}` : "WALLET:";
  }, [topSource, bankId, walletKey]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.title ?? "Thu tiền thu hộ"}</DialogTitle>
          <DialogDescription>
            {props.description ??
              "Giao dịch thu tiền — tiền vào quỹ đã chọn. Không kiểm tra số dư trước khi ghi nhận."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">{props.fundSelectLabel ?? "Lựa chọn quỹ tiền vào"}</div>
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
              value={topSource}
              onChange={(e) => setTopSource(e.target.value as TopSource)}
            >
              <option value="CASH">Tiền mặt</option>
              <option value="BANK">TK ngân hàng</option>
              <option value="WALLET">Ví tài xế</option>
            </select>
          </div>

          {topSource === "BANK" ? (
            <div className="space-y-1">
              <div className="text-sm font-medium">Tài khoản ngân hàng</div>
              <select
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                value={bankId}
                onChange={(e) => setBankId(e.target.value as BankSourceId)}
              >
                {bankRows.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {topSource === "WALLET" && wallets.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
              Chưa có ví tài xế. Thêm ví trong mục Tài chính → Ví tài xế.
            </div>
          ) : null}

          {topSource === "WALLET" && wallets.length > 0 ? (
            <div className="space-y-1">
              <div className="text-sm font-medium">Tài khoản ví tài xế</div>
              <select
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                value={walletKey}
                onChange={(e) => setWalletKey(e.target.value)}
              >
                <option value="" disabled>
                  --- Công ty ---
                </option>
                {walletOptions.roster.map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.walletName} • {w.driverName} • {formatBalances(w.balances)}
                  </option>
                ))}
                <option value="" disabled>
                  --- Ngoài ---
                </option>
                {walletOptions.dispatch.map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.walletName} • {w.driverName} • {formatBalances(w.balances)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {topSource === "BANK" ? (
            <div className="space-y-3">
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
                <span className="text-zinc-500 dark:text-zinc-400">Đơn vị tiền tệ (theo TK): </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{lockedCurrency ?? "—"}</span>
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
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">Đơn vị tiền tệ</div>
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
                  value={currency}
                  disabled={!!lockedCurrency}
                  onChange={(e) => setCurrency(e.target.value as PaymentCurrency)}
                >
                  {allowedCurrencyList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
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
          )}

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
                if (topSource === "WALLET") {
                  if (wallets.length === 0) return setError("Chưa có ví tài xế để ghi nhận.");
                  if (!walletKey) return setError("Vui lòng chọn ví tài xế.");
                }
                const cur = (lockedCurrency ?? currency ?? "VND").trim().toUpperCase();
                if (!cur) return setError("Vui lòng chọn loại tiền.");
                setBusy(true);
                try {
                  await props.onConfirm({ sourceId, currency: cur, amount: num });
                  props.onOpenChange(false);
                  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                } catch (e) {
                  const msg = String((e as { message?: unknown })?.message ?? e ?? "unknown");
                  setError(msg || "Không thể ghi nhận. Vui lòng thử lại.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Đang lưu…" : props.confirmLabel ?? "Thu Tiền"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
