/**
 * Kiểu & hàm khóa ví dùng chung với Firestore (`driverWallets`).
 * Không còn lưu danh sách ví trong localStorage — nguồn duy nhất là Firestore.
 */

export type DriverWallet = {
  /** Khóa ổn định: `emp:{mã NV}` hoặc `ext:{sdt}:{biển}`. */
  key: string;
  /** Tên ví = {Mã tài xế}WD. */
  walletName: string;
  /** Số dư theo từng loại tiền (VND, USD, ...). */
  balances: Record<string, number>;
  source: "roster" | "dispatch";
  employeeCode?: string;
  driverName: string;
  phone?: string;
  plate?: string;
  createdAt: number;
  updatedAt: number;
};

function normalizePlate(plate: string): string {
  return plate.replace(/\s+/g, "").replace(/\./g, "").toUpperCase();
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function rosterWalletKey(employeeCode: string): string {
  return `emp:${employeeCode}`;
}

export function dispatchWalletKey(phone: string, plate: string): string {
  return `ext:${normalizePhoneDigits(phone)}:${normalizePlate(plate)}`;
}

export function walletNameFromDriverCode(driverCode: string) {
  return `${driverCode}WD`;
}

/** OD + 5 số (ổn định theo SĐT + biển). */
export function odCodeFromExternal(phone: string, plate: string) {
  const a = normalizePhoneDigits(phone);
  const b = normalizePlate(plate);
  const seed = `${a}|${b}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const n = h % 100000;
  return `OD${String(n).padStart(5, "0")}`;
}

/** Key localStorage cũ (demo); gọi một lần khi vào app để tránh nhầm với ví thật. */
export const LEGACY_DRIVER_WALLETS_STORAGE_KEY = "getdriver.fleet.driverWallets.v1";

export function clearLegacyDriverWalletLocalStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_DRIVER_WALLETS_STORAGE_KEY);
  } catch {
    // ignore
  }
}
