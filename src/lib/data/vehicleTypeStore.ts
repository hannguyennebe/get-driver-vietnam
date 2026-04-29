export type VehicleType = {
  id: string;
  name: string;
  createdAt: number;
};

const KEY = "getdriver.data.vehicle-types.v1";

const SEED: VehicleType[] = [
  { id: "VT-001", name: "Xe 4 chỗ", createdAt: Date.now() - 1000 * 60 * 60 * 24 },
  { id: "VT-002", name: "Xe 7 chỗ", createdAt: Date.now() - 1000 * 60 * 60 * 20 },
  { id: "VT-003", name: "Xe 16 chỗ", createdAt: Date.now() - 1000 * 60 * 60 * 16 },
  { id: "VT-004", name: "Xe 29 chỗ", createdAt: Date.now() - 1000 * 60 * 60 * 12 },
];

function safeParse(raw: string | null): VehicleType[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VehicleType[];
  } catch {
    return null;
  }
}

export function ensureVehicleTypeStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify(SEED));
}

export function listVehicleTypes(): VehicleType[] {
  ensureVehicleTypeStore();
  return safeParse(localStorage.getItem(KEY)) ?? [];
}

export function upsertVehicleType(next: VehicleType) {
  const all = listVehicleTypes();
  const idx = all.findIndex((x) => x.id === next.id);
  const merged =
    idx >= 0 ? all.map((x) => (x.id === next.id ? next : x)) : [next, ...all];
  localStorage.setItem(KEY, JSON.stringify(merged));
}

export function deleteVehicleType(id: string) {
  const all = listVehicleTypes();
  localStorage.setItem(KEY, JSON.stringify(all.filter((x) => x.id !== id)));
}

export function generateVehicleTypeId(existingIds: string[]) {
  const set = new Set(existingIds);
  for (let i = 0; i < 50; i++) {
    const id = `VT-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    if (!set.has(id)) return id;
  }
  return `VT-${String(Date.now() % 1000).padStart(3, "0")}`;
}

