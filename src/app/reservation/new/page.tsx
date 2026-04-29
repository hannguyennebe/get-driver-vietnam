"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDemoSession } from "@/lib/auth/demo";
import { ensurePartnersStore, getPartners } from "@/lib/data/partnersStore";
import {
  ensureItineraryStore,
  listItineraries,
  type Itinerary,
} from "@/lib/data/itineraryStore";
import {
  ensureVehicleTypeStore,
  listVehicleTypes,
  type VehicleType,
} from "@/lib/data/vehicleTypeStore";
import {
  addReservation,
  generateBookingId,
  listReservations,
  updateReservation,
  type Currency,
  type PaymentType,
  type Reservation,
} from "@/lib/reservations/reservationStore";
import { useRouter } from "next/navigation";
import { Calendar as CalendarIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function ReservationNewPage() {
  return (
    <React.Suspense fallback={<ReservationNewSkeleton />}>
      <ReservationNewInner />
    </React.Suspense>
  );
}

function ReservationNewSkeleton() {
  return (
    <AppShell>
      <div className="flex-1 px-6 pb-10">
        <div className="pt-6">
          <div className="h-7 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-4 w-80 rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </div>
    </AppShell>
  );
}

function ReservationNewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sales, setSales] = React.useState("—");
  const [createdAt, setCreatedAt] = React.useState<Date | null>(null);

  const [travelAgents, setTravelAgents] = React.useState<
    Array<{ id: string; name: string; paymentType?: "Phải Trả" | "Công Nợ"; taxIncluded?: boolean }>
  >([]);
  const [itineraries, setItineraries] = React.useState<Itinerary[]>([]);
  const [vehicleTypes, setVehicleTypes] = React.useState<VehicleType[]>([]);

  const [error, setError] = React.useState<string | null>(null);
  const [editingCode, setEditingCode] = React.useState<string | null>(null);
  const fromDashboard = searchParams.get("from") === "dashboard";

  const [form, setForm] = React.useState({
    bookingId: "",
    travelAgentId: "",
    tripDateISO: "",
    pickupTime: "",
    customerName: "",
    customerCount: "1",
    itinerary: "",
    vehicleType: "",
    unitQty: "1",
    unitPrice: "0",
    taxIncluded: "Không" as "Không" | "Có",
    currency: "VND" as Currency,
    pickup: "",
    dropoff: "",
    distanceKm: "0",
    paymentType: "Phải Thu" as PaymentType,
    thuHoAmount: "0",
    thuHoCurrency: "VND" as Currency,
    note: "",
  });

  React.useEffect(() => {
    setCreatedAt(new Date());
    const s = typeof window !== "undefined" ? getDemoSession() : null;
    setSales(s?.username ?? "—");

    ensurePartnersStore();
    const p = getPartners();
    setTravelAgents(
      p.travelAgents.map((x) => ({
        id: x.id,
        name: x.name,
        paymentType: x.paymentType,
        taxIncluded: x.taxIncluded,
      })),
    );

    ensureItineraryStore();
    setItineraries(listItineraries());

    ensureVehicleTypeStore();
    const vt = listVehicleTypes();
    setVehicleTypes(vt);
    setForm((s) => ({ ...s, vehicleType: s.vehicleType || vt[0]?.name || "Xe 4 chỗ" }));

    const code = searchParams.get("code");
    if (code) {
      const existing = listReservations().find((r) => r.code === code);
      if (existing) {
        setEditingCode(existing.code);
        setForm((s) => ({
          ...s,
          bookingId: existing.code,
          travelAgentId: existing.travelAgentId ?? "",
          tripDateISO: dmyToIso(existing.date),
          pickupTime: existing.time ?? "",
          customerName: existing.customerName ?? "",
          customerCount: String(existing.customerCount ?? 1),
          itinerary: existing.itinerary ?? "",
          vehicleType: existing.vehicleType ?? (vt[0]?.name || ""),
          unitQty: String(existing.unitQty ?? 1),
          unitPrice: String(existing.unitPrice ?? 0),
          taxIncluded: existing.taxIncluded ? ("Có" as const) : ("Không" as const),
          currency: (existing.currency ?? "VND") as Currency,
          pickup: existing.pickup ?? "",
          dropoff: existing.dropoff ?? "",
          distanceKm: String(existing.distanceKm ?? 0),
          paymentType: (existing.paymentType ?? "Phải Thu") as PaymentType,
          thuHoAmount: String(existing.thuHoAmount ?? 0),
          thuHoCurrency: (existing.thuHoCurrency ?? "VND") as Currency,
          note: existing.note ?? "",
        }));
      }
    } else {
      const id = generateBookingId(listReservations().map((r) => r.code));
      setForm((s) => ({ ...s, bookingId: id }));
      setEditingCode(null);
    }

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.includes("getdriver.data.itineraries")) {
        setItineraries(listItineraries());
      }
      if (e.key.includes("getdriver.data.vehicle-types")) {
        const next = listVehicleTypes();
        setVehicleTypes(next);
        setForm((s) => ({
          ...s,
          vehicleType:
            s.vehicleType && next.some((x) => x.name === s.vehicleType)
              ? s.vehicleType
              : next[0]?.name || "",
        }));
      }
      if (e.key.includes("getdriver.data.partners")) {
        const pp = getPartners();
        setTravelAgents(
          pp.travelAgents.map((x) => ({
            id: x.id,
            name: x.name,
            paymentType: x.paymentType,
            taxIncluded: x.taxIncluded,
          })),
        );
      }
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => {
      setItineraries(listItineraries());
      const next = listVehicleTypes();
      setVehicleTypes(next);
      setForm((s) => ({
        ...s,
        vehicleType:
          s.vehicleType && next.some((x) => x.name === s.vehicleType)
            ? s.vehicleType
            : next[0]?.name || "",
      }));
      const pp = getPartners();
      setTravelAgents(
        pp.travelAgents.map((x) => ({
          id: x.id,
          name: x.name,
          paymentType: x.paymentType,
          taxIncluded: x.taxIncluded,
        })),
      );
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const qty = Number(form.unitQty) || 0;
  const unitPrice = Number(form.unitPrice) || 0;
  const amount = qty * unitPrice;

  return (
    <AppShell>
      <div className="flex-1 px-6 pb-10">
        <div className="pt-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Chi tiết Booking
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Tạo booking mới để đưa vào Reservation List
          </p>

          <div className="mt-5 max-w-4xl rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Booking ID">
                <Input value={form.bookingId} readOnly />
              </Field>
              <Field label="Sales">
                <Input value={sales} readOnly />
              </Field>
              <Field label="Ngày đặt booking">
                <Input
                  value={
                    createdAt
                      ? `${createdAt.toLocaleDateString("vi-VN")} ${createdAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`
                      : "—"
                  }
                  readOnly
                />
              </Field>

              <Field label="Ngày đi">
                <DatePickerInput
                  value={form.tripDateISO}
                  onChange={(v) => setForm({ ...form, tripDateISO: v })}
                />
              </Field>
              <Field label="Giờ Đón">
                <TimeInput
                  value={form.pickupTime}
                  onChange={(v) => setForm({ ...form, pickupTime: v })}
                />
              </Field>
              <Field label="Loại xe">
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                  value={form.vehicleType}
                  onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                >
                  {vehicleTypes.length === 0 ? (
                    <option value="">—</option>
                  ) : null}
                  {vehicleTypes.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Tên khách">
                <Input
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                />
              </Field>
              <Field label="Số lượng khách">
                <Input
                  value={form.customerCount}
                  onChange={(e) => setForm({ ...form, customerCount: e.target.value })}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Hành Trình">
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                  value={form.itinerary}
                  onChange={(e) => setForm({ ...form, itinerary: e.target.value })}
                >
                  <option value="">—</option>
                  {itineraries.map((it) => (
                    <option key={it.id} value={it.name}>
                      {it.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Điểm đón">
                <Input
                  value={form.pickup}
                  onChange={(e) => setForm({ ...form, pickup: e.target.value })}
                />
              </Field>
              <Field label="Điểm Trả">
                <Input
                  value={form.dropoff}
                  onChange={(e) => setForm({ ...form, dropoff: e.target.value })}
                />
              </Field>
              <Field label="Khoản cách (Km)">
                <Input
                  value={form.distanceKm}
                  onChange={(e) => setForm({ ...form, distanceKm: e.target.value })}
                  inputMode="decimal"
                  placeholder="0"
                />
              </Field>
            </div>

            <div className="mt-6 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Đơn vị tính - Đơn giá - Thành tiền
              </div>

              <div className="mt-4 grid gap-3">
                <div className="grid gap-3">
                  <Input
                    value={form.unitQty}
                    onChange={(e) => setForm({ ...form, unitQty: e.target.value })}
                    inputMode="numeric"
                    placeholder="Đơn vị tính"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <Input
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    inputMode="numeric"
                    placeholder={`Đơn giá (${form.currency})`}
                  />

                  <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      Giá bao gồm thuế
                    </span>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.taxIncluded === "Không"}
                        onChange={() => setForm({ ...form, taxIncluded: "Không" })}
                      />
                      Không
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.taxIncluded === "Có"}
                        onChange={() => setForm({ ...form, taxIncluded: "Có" })}
                      />
                      Có
                    </label>
                  </div>

                  <div className="inline-flex w-fit overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      className={`px-4 py-2 text-sm font-medium ${form.currency === "VND" ? "bg-[#2E7AB0] text-white" : "bg-white text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"}`}
                      onClick={() => setForm({ ...form, currency: "VND" })}
                    >
                      VND
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 text-sm font-medium ${form.currency === "USD" ? "bg-[#2E7AB0] text-white" : "bg-white text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"}`}
                      onClick={() => setForm({ ...form, currency: "USD" })}
                    >
                      USD
                    </button>
                  </div>
                </div>

                <Input value={`${amount.toLocaleString("vi-VN")} ${form.currency}`} readOnly />
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Travel Agent">
                  <select
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                    value={form.travelAgentId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const ta = travelAgents.find((x) => x.id === id);
                      setForm({
                        ...form,
                        travelAgentId: id,
                        paymentType:
                          ta?.paymentType === "Công Nợ"
                            ? "Công Nợ"
                            : ta?.paymentType === "Phải Trả"
                              ? "Phải Thu"
                              : form.paymentType,
                        taxIncluded:
                          ta?.taxIncluded === true
                            ? "Có"
                            : ta?.taxIncluded === false
                              ? "Không"
                              : form.taxIncluded,
                      });
                    }}
                  >
                    <option value="">—</option>
                    {travelAgents.map((ta) => (
                      <option key={ta.id} value={ta.id}>
                        {ta.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Thanh toán">
                  <div className="flex items-center gap-6 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.paymentType === "Phải Thu"}
                        onChange={() =>
                          setForm({ ...form, paymentType: "Phải Thu" })
                        }
                      />
                      Phải Thu
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.paymentType === "Công Nợ"}
                        onChange={() =>
                          setForm({ ...form, paymentType: "Công Nợ" })
                        }
                      />
                      Công Nợ
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.paymentType === "Ví tài xế"}
                        onChange={() =>
                          setForm({ ...form, paymentType: "Ví tài xế" })
                        }
                      />
                      Ví tài xế
                    </label>
                  </div>
                </Field>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Thu Hộ</label>
                <div className="flex gap-2">
                  <Input
                    value={form.thuHoAmount}
                    onChange={(e) =>
                      setForm({ ...form, thuHoAmount: e.target.value })
                    }
                    inputMode="numeric"
                    placeholder="0"
                  />
                  <select
                    className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                    value={form.thuHoCurrency}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        thuHoCurrency: e.target.value as Currency,
                      })
                    }
                  >
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Field label="Ghi chú">
                <Input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </Field>
            </div>

            {error ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                className="h-9"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                className="h-9 bg-[#2E7AB0] text-white hover:bg-[#276a98]"
                onClick={() => {
                  setError(null);
                  if (!form.tripDateISO.trim()) return setError("Vui lòng chọn Ngày đi.");
                  if (!form.pickupTime.trim()) return setError("Vui lòng nhập Giờ đón.");
                  if (!form.customerName.trim()) return setError("Vui lòng nhập Tên khách.");
                  const customerCount = Number(form.customerCount);
                  if (!Number.isFinite(customerCount) || customerCount <= 0) {
                    return setError("Số lượng khách không hợp lệ.");
                  }
                  const unitQty = Number(form.unitQty);
                  if (!Number.isFinite(unitQty) || unitQty <= 0) {
                    return setError("Đơn vị tính không hợp lệ.");
                  }
                  const unitPrice = Number(form.unitPrice);
                  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                    return setError("Đơn giá không hợp lệ.");
                  }
                  const distanceKm = Number(form.distanceKm);
                  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
                    return setError("Khoản cách không hợp lệ.");
                  }
                  const thuHoAmount = Number(form.thuHoAmount);
                  if (!Number.isFinite(thuHoAmount) || thuHoAmount < 0) {
                    return setError("Thu hộ không hợp lệ.");
                  }

                  const next: Reservation = {
                    code: form.bookingId,
                    createdAt: editingCode
                      ? (listReservations().find((r) => r.code === editingCode)?.createdAt ?? Date.now())
                      : Date.now(),
                    createdDate: editingCode
                      ? (listReservations().find((r) => r.code === editingCode)?.createdDate ??
                        (createdAt ?? new Date()).toLocaleDateString("vi-VN"))
                      : (createdAt ?? new Date()).toLocaleDateString("vi-VN"),
                    createdTime: editingCode
                      ? (listReservations().find((r) => r.code === editingCode)?.createdTime ??
                        (createdAt ?? new Date()).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }))
                      : (createdAt ?? new Date()).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                    sales,
                    date: isoToDmy(form.tripDateISO),
                    time: form.pickupTime.trim(),
                    customerName: form.customerName.trim(),
                    customerCount,
                    itinerary: form.itinerary.trim(),
                    vehicleType: form.vehicleType,
                    unitQty,
                    unitPrice,
                    taxIncluded: form.taxIncluded === "Có",
                    currency: form.currency,
                    amount: unitQty * unitPrice,
                    pickup: form.pickup.trim(),
                    dropoff: form.dropoff.trim(),
                    distanceKm,
                    travelAgentId: form.travelAgentId || undefined,
                    paymentType: form.paymentType,
                    thuHoAmount,
                    thuHoCurrency: form.thuHoCurrency,
                    note: form.note,
                    status: "Chờ điều xe",
                  };

                  try {
                    if (editingCode) {
                      updateReservation(editingCode, {
                        sales: next.sales,
                        date: next.date,
                        time: next.time,
                        customerName: next.customerName,
                        customerCount: next.customerCount,
                        itinerary: next.itinerary,
                        vehicleType: next.vehicleType,
                        unitQty: next.unitQty,
                        unitPrice: next.unitPrice,
                        taxIncluded: next.taxIncluded,
                        currency: next.currency,
                        amount: next.amount,
                        pickup: next.pickup,
                        dropoff: next.dropoff,
                        distanceKm: next.distanceKm,
                        travelAgentId: next.travelAgentId,
                        paymentType: next.paymentType,
                        thuHoAmount: next.thuHoAmount,
                        thuHoCurrency: next.thuHoCurrency,
                        note: next.note,
                        // Editing booking resets dispatch status by design.
                        status: "Chờ điều xe",
                        assignedDriver: undefined,
                        assignedDriverPhone: undefined,
                        assignedVehiclePlate: undefined,
                        assignedExternalPriceVnd: undefined,
                        assignedSupplierId: undefined,
                        assignedSupplierPaymentType: undefined,
                      });
                      router.replace(fromDashboard ? "/dashboard" : "/data/reservations");
                    } else {
                      addReservation(next);
                      router.replace("/data/reservations");
                    }
                  } catch {
                    setError("Không thể tạo booking. Vui lòng thử lại.");
                  }
                }}
              >
                {editingCode ? "Lưu thay đổi" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function DatePickerInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="gdvn-date h-10 w-full rounded-md border border-zinc-200 bg-white px-3 pr-10 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
        onClick={() => {
          const el = document.querySelector<HTMLInputElement>("input.gdvn-date");
          if (!el) return;
          el.focus();
          // Some browsers support showPicker()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (el as any).showPicker?.();
        }}
        aria-label="Chọn ngày"
      >
        <CalendarIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function TimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(normalizeTimeInput(e.target.value))}
      placeholder="09:00"
      inputMode="numeric"
      maxLength={5}
    />
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function isoToDmy(iso: string) {
  // iso: yyyy-mm-dd
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function dmyToIso(dmy: string) {
  const [d, m, y] = String(dmy || "").split("/");
  if (!y || !m || !d) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normalizeTimeInput(raw: string) {
  const digits = raw.replace(/[^\d]/g, "").slice(0, 4); // HHmm
  if (digits.length <= 2) return digits;
  const hh = digits.slice(0, 2);
  const mm = digits.slice(2);
  return mm.length > 0 ? `${hh}:${mm}` : hh;
}

