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
  /** Tên xe gọi ý (đặc biệt điều xe ngoài — VD: Toyota Fortuner). */
  assignedVehicleName?: string;
  assignedVehiclePlate?: string;
  assignedDriverPhone?: string;
  assignedExternalPriceVnd?: number;
  assignedSupplierId?: string;
  assignedSupplierPaymentType?: "Phải Trả" | "Công Nợ";
};

export type CancelledReservation = Reservation & {
  cancelledAt: number;
  cancelledBy?: string;
  cancelledFrom?: "reservation" | "calendar";
};

// GO LIVE: Reservations are stored in Firestore.
// This file keeps only shared types + booking id generator. The data access is in
// `src/lib/reservations/reservationsFirestore.ts`.

export function generateBookingId(existingCodes: string[]) {
  const set = new Set(existingCodes);
  for (let i = 0; i < 50; i++) {
    const code = `GDVN/${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
    if (!set.has(code)) return code;
  }
  return `GDVN/${String(Date.now() % 100000).padStart(5, "0")}`;
}

