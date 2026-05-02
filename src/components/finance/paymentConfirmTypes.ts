export type PaymentSourceKind = "CASH" | "BANK_VAT_VND" | "BANK_NOVAT_VND" | "BANK_USD" | "WALLET";
export type PaymentCurrency = string; // "VND" | "USD" | "AUD" | ...

/** Quỹ tiền mặt — đủ 6 loại hiển thị khi thu / ghi nhận (credit). */
export const CASH_FUND_CURRENCY_OPTIONS: PaymentCurrency[] = ["VND", "USD", "EUR", "AUD", "GBP", "CNY"];

export type PaymentConfirmResult = {
  sourceId: string; // CASH / VAT_VND / NOVAT_VND / USD / WALLET:<walletKey>
  currency: PaymentCurrency;
  amount: number;
};

export function formatBalances(balances: Record<string, number> | undefined) {
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
