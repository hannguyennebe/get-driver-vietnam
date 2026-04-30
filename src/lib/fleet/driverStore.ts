export type DriverType = "internal" | "external";
export type DriverStatus =
  | "Sẵn sàng"
  | "Đang chạy"
  | "Nghỉ Phép"
  | "Bận giấy tờ";

export type DriverVehicleInfo = {
  carType: string;
  carNumber: string;
  color: string;
};

export type Driver = {
  employeeCode: string; // 5 digits
  name: string;
  phone: string;
  licenseType: string;
  type: DriverType;
  status: DriverStatus;
  trips: number;
  vehiclePlate?: string;
  createdAt: number;
  updatedAt: number;
};

const KEY = "getdriver.fleet.drivers.v1";

// Go-live: no demo seed data.
const SEED: Driver[] = [];

function safeParse(raw: string | null): Driver[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Driver[];
  } catch {
    return null;
  }
}

export function ensureDriverStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify(SEED));
}

export function listDrivers(): Driver[] {
  ensureDriverStore();
  const raw = safeParse(localStorage.getItem(KEY)) ?? [];
  // Backward-compat: older local data might have `rating` + status "Nghỉ".
  return raw.map((d: any) => ({
    ...d,
    status: d.status === "Nghỉ" ? "Nghỉ Phép" : d.status,
  })) as Driver[];
}

export function addDriver(next: Driver) {
  const all = listDrivers();
  if (all.some((d) => d.employeeCode === next.employeeCode)) {
    throw new Error("duplicate_employee_code");
  }
  if (all.some((d) => d.phone === next.phone)) {
    throw new Error("duplicate_phone");
  }
  all.unshift(next);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function updateDriver(employeeCode: string, patch: Partial<Driver>) {
  const all = listDrivers();
  const idx = all.findIndex((d) => d.employeeCode === employeeCode);
  if (idx < 0) throw new Error("not_found");
  const next = { ...all[idx]!, ...patch, updatedAt: Date.now() };
  all[idx] = next;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteDriver(employeeCode: string) {
  const all = listDrivers().filter((d) => d.employeeCode !== employeeCode);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function generateEmployeeCode(existingCodes: string[]) {
  const set = new Set(existingCodes);
  for (let i = 0; i < 50; i++) {
    const code = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
    if (!set.has(code)) return code;
  }
  let n = 1;
  while (set.has(String(n).padStart(5, "0"))) n++;
  return String(n).padStart(5, "0");
}

