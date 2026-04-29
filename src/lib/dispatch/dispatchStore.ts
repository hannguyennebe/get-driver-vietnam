export type DispatchStatus = "Chờ điều xe" | "Đã điều xe";

export type DispatchOrder = {
  code: string; // T001...
  customerName: string;
  pickup: string;
  dropoff: string;
  date: string; // dd/mm/yyyy
  time: string; // HH:mm
  vehicleType: string; // "Xe 7 chỗ"...
  status: DispatchStatus;
  assignedDriver?: string;
};

const KEY = "getdriver.dispatch.orders.v1";

const SEED: DispatchOrder[] = [
  {
    code: "T001",
    customerName: "Nguyễn Văn A",
    pickup: "Sân bay Tân Sơn Nhất",
    dropoff: "Vũng Tàu",
    date: "25/04/2026",
    time: "09:00",
    vehicleType: "Xe 7 chỗ",
    status: "Chờ điều xe",
  },
  {
    code: "T002",
    customerName: "Trần Thị B",
    pickup: "G1, TPHCM",
    dropoff: "Đà Lạt",
    date: "25/04/2026",
    time: "08:40",
    vehicleType: "Xe 16 chỗ",
    status: "Chờ điều xe",
  },
  {
    code: "T003",
    customerName: "Lê Văn C",
    pickup: "C7, TPHCM",
    dropoff: "Cần Thơ",
    date: "26/04/2026",
    time: "07:30",
    vehicleType: "Xe 4 chỗ",
    status: "Đã điều xe",
    assignedDriver: "Nguyễn Văn A",
  },
  {
    code: "T004",
    customerName: "Công ty XYZ",
    pickup: "KCN Bình Dương",
    dropoff: "Sân bay Tân Sơn Nhất",
    date: "26/04/2026",
    time: "14:00",
    vehicleType: "Xe 29 chỗ",
    status: "Chờ điều xe",
  },
  {
    code: "T005",
    customerName: "Hoàng Minh E",
    pickup: "G3, TPHCM",
    dropoff: "Phan Thiết",
    date: "27/04/2026",
    time: "09:00",
    vehicleType: "Xe 7 chỗ",
    status: "Đã điều xe",
    assignedDriver: "Nguyễn Văn F",
  },
];

function safeParse(raw: string | null): DispatchOrder[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DispatchOrder[];
  } catch {
    return null;
  }
}

export function ensureDispatchStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify(SEED));
}

export function listDispatchOrders(): DispatchOrder[] {
  ensureDispatchStore();
  return safeParse(localStorage.getItem(KEY)) ?? [];
}

