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

const SEED: Driver[] = [
  {
    employeeCode: "10001",
    name: "Nguyễn Văn An",
    phone: "0901234567",
    licenseType: "B2",
    type: "internal",
    status: "Sẵn sàng",
    trips: 156,
    vehiclePlate: "51A-123.45",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    employeeCode: "10002",
    name: "Trần Minh Tuấn",
    phone: "0912345678",
    licenseType: "C",
    type: "internal",
    status: "Bận giấy tờ",
    trips: 203,
    vehiclePlate: "51A-234.56",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    employeeCode: "20001",
    name: "Lê Hoàng Nam",
    phone: "0923456789",
    licenseType: "B2",
    type: "external",
    status: "Sẵn sàng",
    trips: 89,
    vehiclePlate: "51A-345.67",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    employeeCode: "10003",
    name: "Phạm Đức Huy",
    phone: "0934567890",
    licenseType: "D",
    type: "internal",
    status: "Nghỉ Phép",
    trips: 124,
    vehiclePlate: "51A-456.78",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    employeeCode: "20002",
    name: "Võ Thanh Sơn",
    phone: "0945678901",
    licenseType: "B2",
    type: "external",
    status: "Sẵn sàng",
    trips: 178,
    vehiclePlate: "51A-567.89",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

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

