export type TripStatus = "Đã đặt" | "Đang chạy" | "Hoàn thành";

export type Trip = {
  id: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  customer: string;
  from: string;
  to: string;
  status: TripStatus;
  revenueVnd: number;
  driverName?: string;
  driverPhone?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  vehicleColor?: string;
};

const KEY = "getdriver.calendar.trips.v1";

// GO LIVE: no demo seed
const SEED: Trip[] = [];

function safeParse(raw: string | null): Trip[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Trip[];
  } catch {
    return null;
  }
}

export function ensureTripsStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify(SEED));
}

export function listTrips(): Trip[] {
  ensureTripsStore();
  return safeParse(localStorage.getItem(KEY)) ?? [];
}

export function deleteTrip(id: string) {
  const all = listTrips();
  localStorage.setItem(KEY, JSON.stringify(all.filter((t) => t.id !== id)));
}

