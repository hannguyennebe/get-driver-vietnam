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

const SEED: Trip[] = [
  {
    id: "T-1001",
    date: "2026-04-27",
    time: "09:00",
    customer: "Nguyễn Văn A",
    from: "Q.1",
    to: "Sân bay Tân Sơn Nhất",
    status: "Hoàn thành",
    revenueVnd: 350000,
    driverName: "Nguyễn Văn An",
    driverPhone: "0901234567",
    vehiclePlate: "51A-123.45",
    vehicleType: "7 chỗ",
    vehicleColor: "Trắng",
  },
  {
    id: "T-1002",
    date: "2026-04-27",
    time: "14:30",
    customer: "Trần Thị B",
    from: "Thủ Đức",
    to: "Q.3",
    status: "Đang chạy",
    revenueVnd: 220000,
    driverName: "Trần Minh Tuấn",
    driverPhone: "0912345678",
    vehiclePlate: "51A-234.56",
    vehicleType: "4 chỗ",
    vehicleColor: "Đen",
  },
  {
    id: "T-1003",
    date: "2026-04-29",
    time: "08:15",
    customer: "Phạm Văn C",
    from: "Bình Thạnh",
    to: "Q.7",
    status: "Đã đặt",
    revenueVnd: 180000,
  },
];

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

