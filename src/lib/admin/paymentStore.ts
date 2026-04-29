export type PaymentAccount = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  updatedAt: number;
};

export type PaymentInfo = {
  vatVnd: PaymentAccount;
  noVatVnd: PaymentAccount;
  usd: PaymentAccount;
};

const KEY = "getdriver.payment.info.v1";

const DEFAULT: PaymentInfo = {
  vatVnd: {
    bankName: "Ngân hàng Vietcombank",
    accountNumber: "1234567890123",
    accountHolder: "GET DRIVER VIETNAM CO., LTD",
    updatedAt: Date.now(),
  },
  noVatVnd: {
    bankName: "Ngân hàng Techcombank",
    accountNumber: "9876543210987",
    accountHolder: "GET DRIVER VIETNAM CO., LTD",
    updatedAt: Date.now(),
  },
  usd: {
    bankName: "Ngân hàng HSBC",
    accountNumber: "001234567890",
    accountHolder: "GET DRIVER VIETNAM CO., LTD",
    updatedAt: Date.now(),
  },
};

function safeParse(raw: string | null): PaymentInfo | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PaymentInfo;
  } catch {
    return null;
  }
}

export function getPaymentInfo(): PaymentInfo {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return existing;
  localStorage.setItem(KEY, JSON.stringify(DEFAULT));
  return DEFAULT;
}

export function setPaymentInfo(next: PaymentInfo) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

