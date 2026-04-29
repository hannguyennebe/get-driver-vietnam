import { listDrivers } from "@/lib/fleet/driverStore";

const STORAGE_KEY = "getdriver.fleet.driverWallets.v1";

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

function safeParse(raw: string | null): DriverWallet[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DriverWallet[];
  } catch {
    return null;
  }
}

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

export function ensureDriverWalletStore() {
  const existing = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!existing) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    return;
  }
  // Migration:
  // - rename walletName to {driverCode}WD
  // - migrate balanceVnd -> balances.VND (if balances missing)
  let changed = false;
  const now = Date.now();
  const migrated = existing.map((w) => {
    const expected =
      w.source === "roster" && w.employeeCode
        ? walletNameFromDriverCode(String(w.employeeCode))
        : w.source === "dispatch" && w.phone && w.plate
          ? walletNameFromDriverCode(odCodeFromExternal(w.phone, w.plate))
          : w.walletName;
    const nextAny: any = w as any;
    const nextBalances: Record<string, number> =
      typeof (nextAny as any).balances === "object" && (nextAny as any).balances
        ? (nextAny as any).balances
        : { VND: Number((nextAny as any).balanceVnd ?? 0) || 0 };

    const walletNameChanged = expected !== (w as any).walletName;
    const balancesChanged = !((w as any).balances);
    if (walletNameChanged || balancesChanged) {
      changed = true;
      return { ...(w as any), walletName: expected, balances: nextBalances, updatedAt: now } as DriverWallet;
    }
    return { ...(w as any), balances: nextBalances } as DriverWallet;
  });
  if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
}

export function listDriverWallets(): DriverWallet[] {
  ensureDriverWalletStore();
  return safeParse(localStorage.getItem(STORAGE_KEY)) ?? [];
}

function persist(rows: DriverWallet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

export function adjustDriverWalletBalance(walletKey: string, currency: string, delta: number) {
  ensureDriverWalletStore();
  const all = listDriverWallets();
  const idx = all.findIndex((w) => w.key === walletKey);
  if (idx < 0) throw new Error("wallet_not_found");
  const now = Date.now();
  const curr = all[idx]!;
  const cur = (currency || "VND").trim().toUpperCase();
  const next = {
    ...curr,
    balances: { ...(curr.balances ?? { VND: 0 }), [cur]: (curr.balances?.[cur] ?? 0) + delta },
    updatedAt: now,
  };
  all[idx] = next;
  persist(all);
  return next;
}

/** Tài xế trong danh sách (lái xe nhà hoặc lái xe ngoài đăng ký): một ví / mã NV, số dư mặc định 0. */
export function ensureWalletForRosterDriver(employeeCode: string, driverName: string): DriverWallet {
  ensureDriverWalletStore();
  const key = rosterWalletKey(employeeCode);
  const all = listDriverWallets();
  const existing = all.find((w) => w.key === key);
  if (existing) {
    const trimmed = driverName.trim();
    const expectedName = walletNameFromDriverCode(String(employeeCode));
    if (existing.driverName !== trimmed || existing.walletName !== expectedName) {
      const now = Date.now();
      const next = {
        ...existing,
        driverName: trimmed,
        employeeCode,
        walletName: expectedName,
        updatedAt: now,
      };
      persist(all.map((w) => (w.key === key ? next : w)));
      return next;
    }
    return existing;
  }
  const now = Date.now();
  const wallet: DriverWallet = {
    key,
    walletName: walletNameFromDriverCode(String(employeeCode)),
    balances: { VND: 0 },
    source: "roster",
    employeeCode,
    driverName: driverName.trim(),
    createdAt: now,
    updatedAt: now,
  };
  persist([wallet, ...all]);
  return wallet;
}

/** Sau điều xe ngoài (có tên, SĐT, biển): tạo ví nếu chưa có. */
export function ensureWalletForExternalDispatch(
  driverName: string,
  phone: string,
  plate: string,
): DriverWallet {
  ensureDriverWalletStore();
  const key = dispatchWalletKey(phone, plate);
  const all = listDriverWallets();
  const existing = all.find((w) => w.key === key);
  if (existing) {
    const now = Date.now();
    const nextName = driverName.trim();
    const expectedWalletName = walletNameFromDriverCode(odCodeFromExternal(phone, plate));
    if (existing.driverName !== nextName || existing.walletName !== expectedWalletName) {
      const next = {
        ...existing,
        driverName: nextName,
        phone: phone.trim(),
        plate: normalizePlate(plate),
        walletName: expectedWalletName,
        updatedAt: now,
      };
      persist(all.map((w) => (w.key === key ? next : w)));
      return next;
    }
    return existing;
  }
  const now = Date.now();
  const wallet: DriverWallet = {
    key,
    walletName: walletNameFromDriverCode(odCodeFromExternal(phone, plate)),
    balances: { VND: 0 },
    source: "dispatch",
    driverName: driverName.trim(),
    phone: phone.trim(),
    plate: normalizePlate(plate),
    createdAt: now,
    updatedAt: now,
  };
  persist([wallet, ...all]);
  return wallet;
}

export function getWalletByEmployeeCode(employeeCode: string): DriverWallet | undefined {
  return listDriverWallets().find((w) => w.key === rosterWalletKey(employeeCode));
}

export function getWalletByDispatchPhonePlate(
  phone: string,
  plate: string,
): DriverWallet | undefined {
  const key = dispatchWalletKey(phone, plate);
  return listDriverWallets().find((w) => w.key === key);
}

/** Gọi khi mở trang tài xế: bảo đảm mọi tài xế trong danh bạ có ví. */
export function ensureWalletsForAllRosterDrivers() {
  for (const d of listDrivers()) {
    ensureWalletForRosterDriver(d.employeeCode, d.name);
  }
}
