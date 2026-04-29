export type ReservationStatus = "Chờ điều xe" | "Đã điều xe";

export type Currency = "VND" | "USD";
export type PaymentType = "Phải Thu" | "Công Nợ" | "Ví tài xế";

export type Reservation = {
  code: string; // GDVN/xxxxx
  createdAt: number;
  createdDate: string; // dd/mm/yyyy
  createdTime: string; // HH:mm
  sales: string;
  customerName: string;
  customerCount: number;
  pickup: string;
  dropoff: string;
  date: string; // dd/mm/yyyy
  time: string; // HH:mm
  itinerary: string;
  vehicleType: string;
  distanceKm: number;
  travelAgentId?: string;
  unitQty: number;
  unitPrice: number;
  taxIncluded: boolean;
  currency: Currency;
  amount: number; // unitQty * unitPrice
  paymentType: PaymentType;
  thuHoAmount: number;
  thuHoCurrency: Currency;
  note: string;
  status: ReservationStatus;
  assignedDriver?: string;
  assignedVehiclePlate?: string;
  assignedDriverPhone?: string;
  assignedExternalPriceVnd?: number;
  assignedSupplierId?: string;
  assignedSupplierPaymentType?: "Phải Trả" | "Công Nợ";
};

const KEY = "getdriver.reservations.v1";
const CANCEL_KEY = "getdriver.reservations.cancelled.v1";

export type CancelledReservation = Reservation & {
  cancelledAt: number;
  cancelledBy?: string;
  cancelledFrom?: "reservation" | "calendar";
};

const SEED: Reservation[] = [
  {
    code: "T001",
    createdAt: Date.now(),
    createdDate: "25/04/2026",
    createdTime: "08:00",
    sales: "system",
    customerName: "Nguyễn Văn A",
    customerCount: 2,
    pickup: "Sân bay Tân Sơn Nhất",
    dropoff: "Vũng Tàu",
    date: "25/04/2026",
    time: "09:00",
    itinerary: "TPHCM → Vũng Tàu",
    vehicleType: "Xe 7 chỗ",
    distanceKm: 100,
    travelAgentId: "TA-001",
    unitQty: 1,
    unitPrice: 1500000,
    taxIncluded: false,
    currency: "VND",
    amount: 1500000,
    paymentType: "Phải Thu",
    thuHoAmount: 0,
    thuHoCurrency: "VND",
    note: "",
    status: "Chờ điều xe",
  },
  {
    code: "T002",
    createdAt: Date.now(),
    createdDate: "25/04/2026",
    createdTime: "08:10",
    sales: "system",
    customerName: "Trần Thị B",
    customerCount: 12,
    pickup: "G1, TPHCM",
    dropoff: "Đà Lạt",
    date: "25/04/2026",
    time: "08:40",
    itinerary: "TPHCM → Đà Lạt",
    vehicleType: "Xe 16 chỗ",
    distanceKm: 300,
    travelAgentId: "TA-002",
    unitQty: 1,
    unitPrice: 4500000,
    taxIncluded: true,
    currency: "VND",
    amount: 4500000,
    paymentType: "Công Nợ",
    thuHoAmount: 0,
    thuHoCurrency: "VND",
    note: "",
    status: "Chờ điều xe",
  },
  {
    code: "T003",
    createdAt: Date.now(),
    createdDate: "26/04/2026",
    createdTime: "06:30",
    sales: "system",
    customerName: "Lê Văn C",
    customerCount: 2,
    pickup: "C7, TPHCM",
    dropoff: "Cần Thơ",
    date: "26/04/2026",
    time: "07:30",
    itinerary: "TPHCM → Cần Thơ",
    vehicleType: "Xe 4 chỗ",
    distanceKm: 170,
    unitQty: 1,
    unitPrice: 2000000,
    taxIncluded: false,
    currency: "VND",
    amount: 2000000,
    paymentType: "Phải Thu",
    thuHoAmount: 0,
    thuHoCurrency: "VND",
    note: "",
    status: "Đã điều xe",
    assignedDriver: "Nguyễn Văn A",
  },
  {
    code: "T004",
    createdAt: Date.now(),
    createdDate: "26/04/2026",
    createdTime: "12:00",
    sales: "system",
    customerName: "Công ty XYZ",
    customerCount: 26,
    pickup: "KCN Bình Dương",
    dropoff: "Sân bay Tân Sơn Nhất",
    date: "26/04/2026",
    time: "14:00",
    itinerary: "Bình Dương → Sân bay TSN",
    vehicleType: "Xe 29 chỗ",
    distanceKm: 45,
    unitQty: 1,
    unitPrice: 3500000,
    taxIncluded: false,
    currency: "VND",
    amount: 3500000,
    paymentType: "Phải Thu",
    thuHoAmount: 0,
    thuHoCurrency: "VND",
    note: "",
    status: "Chờ điều xe",
  },
  {
    code: "T005",
    createdAt: Date.now(),
    createdDate: "27/04/2026",
    createdTime: "08:20",
    sales: "system",
    customerName: "Hoàng Minh E",
    customerCount: 8,
    pickup: "G3, TPHCM",
    dropoff: "Phan Thiết",
    date: "27/04/2026",
    time: "09:00",
    itinerary: "TPHCM → Phan Thiết",
    vehicleType: "Xe 7 chỗ",
    distanceKm: 170,
    unitQty: 1,
    unitPrice: 2500000,
    taxIncluded: true,
    currency: "VND",
    amount: 2500000,
    paymentType: "Công Nợ",
    thuHoAmount: 0,
    thuHoCurrency: "VND",
    note: "",
    status: "Đã điều xe",
    assignedDriver: "Nguyễn Văn F",
  },
];

function safeParse(raw: string | null): Reservation[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Reservation[];
  } catch {
    return null;
  }
}

export function ensureReservationStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify(SEED));
}

export function listReservations(): Reservation[] {
  ensureReservationStore();
  const raw = safeParse(localStorage.getItem(KEY)) ?? [];
  // Backward-compat for older seed objects (T00x) missing new fields.
  return raw.map((r: any) => ({
    createdAt: r.createdAt ?? Date.now(),
    createdDate: r.createdDate ?? r.date ?? "",
    createdTime: r.createdTime ?? r.time ?? "",
    sales: r.sales ?? "system",
    customerCount: typeof r.customerCount === "number" ? r.customerCount : 1,
    itinerary: r.itinerary ?? "",
    distanceKm: typeof r.distanceKm === "number" ? r.distanceKm : 0,
    unitQty: typeof r.unitQty === "number" ? r.unitQty : 1,
    unitPrice: typeof r.unitPrice === "number" ? r.unitPrice : 0,
    taxIncluded: Boolean(r.taxIncluded),
    currency: (r.currency === "USD" ? "USD" : "VND") as Currency,
    amount: typeof r.amount === "number" ? r.amount : 0,
    paymentType:
      r.paymentType === "Công Nợ"
        ? ("Công Nợ" as PaymentType)
        : r.paymentType === "Ví tài xế"
          ? ("Ví tài xế" as PaymentType)
          : ("Phải Thu" as PaymentType),
    thuHoAmount: typeof r.thuHoAmount === "number" ? r.thuHoAmount : 0,
    thuHoCurrency: (r.thuHoCurrency === "USD" ? "USD" : "VND") as Currency,
    note: r.note ?? "",
    ...r,
  })) as Reservation[];
}

function safeParseCancelled(raw: string | null): CancelledReservation[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CancelledReservation[];
  } catch {
    return null;
  }
}

export function ensureCancelledReservationStore() {
  const existing = safeParseCancelled(localStorage.getItem(CANCEL_KEY));
  if (existing) return;
  localStorage.setItem(CANCEL_KEY, JSON.stringify([]));
}

export function listCancelledReservations(): CancelledReservation[] {
  ensureCancelledReservationStore();
  return safeParseCancelled(localStorage.getItem(CANCEL_KEY)) ?? [];
}

export function listActiveReservations(): Reservation[] {
  return listReservations();
}

export function generateBookingId(existingCodes: string[]) {
  const set = new Set(existingCodes);
  for (let i = 0; i < 50; i++) {
    const code = `GDVN/${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
    if (!set.has(code)) return code;
  }
  return `GDVN/${String(Date.now() % 100000).padStart(5, "0")}`;
}

export function addReservation(next: Reservation) {
  const all = listReservations();
  if (all.some((r) => r.code === next.code)) {
    throw new Error("duplicate_code");
  }
  all.unshift(next);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function updateReservation(code: string, patch: Partial<Reservation>) {
  const all = listReservations();
  const idx = all.findIndex((r) => r.code === code);
  if (idx < 0) throw new Error("not_found");
  all[idx] = { ...all[idx]!, ...patch };
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function cancelReservation(
  code: string,
  meta?: { cancelledBy?: string; cancelledFrom?: "reservation" | "calendar" },
) {
  const active = listReservations();
  const idx = active.findIndex((r) => r.code === code);
  if (idx < 0) return false;

  ensureCancelledReservationStore();
  const cancelled = listCancelledReservations();
  const r = active[idx]!;
  const entry: CancelledReservation = {
    ...r,
    cancelledAt: Date.now(),
    cancelledBy: meta?.cancelledBy,
    cancelledFrom: meta?.cancelledFrom ?? "reservation",
  };

  const nextActive = active.filter((x) => x.code !== code);
  localStorage.setItem(KEY, JSON.stringify(nextActive));
  localStorage.setItem(CANCEL_KEY, JSON.stringify([entry, ...cancelled]));
  return true;
}

export function cancelFromCalendarTrip(input: {
  code: string;
  dateDmy: string;
  time: string;
  customerName: string;
  pickup: string;
  dropoff: string;
  amountVnd?: number;
}) {
  // If exists in active reservations, cancel it normally.
  const ok = cancelReservation(input.code, { cancelledFrom: "calendar" });
  if (ok) return true;

  // Otherwise store a minimal cancelled entry for calendar demo trips.
  ensureCancelledReservationStore();
  const cancelled = listCancelledReservations();
  const entry: CancelledReservation = {
    code: input.code,
    createdAt: Date.now(),
    createdDate: input.dateDmy,
    createdTime: input.time,
    sales: "—",
    customerName: input.customerName,
    customerCount: 1,
    pickup: input.pickup,
    dropoff: input.dropoff,
    date: input.dateDmy,
    time: input.time,
    itinerary: "",
    vehicleType: "",
    distanceKm: 0,
    unitQty: 1,
    unitPrice: input.amountVnd ?? 0,
    taxIncluded: false,
    currency: "VND",
    amount: input.amountVnd ?? 0,
    paymentType: "Phải Thu",
    thuHoAmount: 0,
    thuHoCurrency: "VND",
    note: "",
    status: "Chờ điều xe",
    cancelledAt: Date.now(),
    cancelledFrom: "calendar",
  };
  localStorage.setItem(CANCEL_KEY, JSON.stringify([entry, ...cancelled]));
  return true;
}

