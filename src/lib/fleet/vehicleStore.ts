export type VehicleStatus = "Sẵn sàng" | "Đang có chuyến" | "Đang bảo trì";

export type Vehicle = {
  plate: string;
  name: string;
  year: number;
  type: string;
  km: number;
  lastServiceKm: number; // Km Bảo Trì Gần Nhất
  lastOilChangeKm: number; // Km Thay Dầu Gần Nhất
  status: VehicleStatus;
  createdAt: number;
  updatedAt: number;
};

const KEY = "getdriver.fleet.vehicles.v1";

const SEED: Vehicle[] = [
  {
    plate: "51A-123.45",
    name: "Toyota Innova",
    year: 2022,
    type: "7 chỗ",
    km: 45000,
    lastServiceKm: 40000,
    lastOilChangeKm: 43000,
    status: "Sẵn sàng",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    plate: "51A-234.56",
    name: "Toyota Vios",
    year: 2023,
    type: "4 chỗ",
    km: 28000,
    lastServiceKm: 25000,
    lastOilChangeKm: 27000,
    status: "Đang có chuyến",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    plate: "51A-345.67",
    name: "Ford Transit",
    year: 2021,
    type: "16 chỗ",
    km: 72000,
    lastServiceKm: 65000,
    lastOilChangeKm: 70000,
    status: "Đang bảo trì",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    plate: "51A-456.78",
    name: "Hyundai Solati",
    year: 2020,
    type: "16 chỗ",
    km: 96000,
    lastServiceKm: 90000,
    lastOilChangeKm: 94000,
    status: "Đang bảo trì",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    plate: "51A-567.89",
    name: "Toyota Hiace",
    year: 2022,
    type: "16 chỗ",
    km: 38000,
    lastServiceKm: 30000,
    lastOilChangeKm: 36000,
    status: "Sẵn sàng",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

function safeParse(raw: string | null): Vehicle[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Vehicle[];
  } catch {
    return null;
  }
}

export function ensureVehicleStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify(SEED));
}

export function listVehicles(): Vehicle[] {
  ensureVehicleStore();
  const raw = safeParse(localStorage.getItem(KEY)) ?? [];
  // Backward-compat for older local data missing new fields.
  return raw.map((v: any) => ({
    ...v,
    lastOilChangeKm:
      typeof v.lastOilChangeKm === "number" ? v.lastOilChangeKm : v.km,
  })) as Vehicle[];
}

export function addVehicle(v: Vehicle) {
  const all = listVehicles();
  if (all.some((x) => x.plate.toLowerCase() === v.plate.toLowerCase())) {
    throw new Error("duplicate_plate");
  }
  all.unshift(v);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function updateVehicle(plateKey: string, next: Vehicle) {
  const all = listVehicles();
  const idx = all.findIndex((x) => x.plate.toLowerCase() === plateKey.toLowerCase());
  if (idx < 0) throw new Error("not_found");

  // If plate changed, ensure uniqueness.
  const plateChanged =
    all[idx]!.plate.toLowerCase() !== next.plate.toLowerCase();
  if (
    plateChanged &&
    all.some((x) => x.plate.toLowerCase() === next.plate.toLowerCase())
  ) {
    throw new Error("duplicate_plate");
  }

  all[idx] = next;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteVehicle(plateKey: string) {
  const all = listVehicles().filter(
    (x) => x.plate.toLowerCase() !== plateKey.toLowerCase(),
  );
  localStorage.setItem(KEY, JSON.stringify(all));
}

