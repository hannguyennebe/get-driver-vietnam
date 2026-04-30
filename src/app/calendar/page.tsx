"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { type Trip, type TripStatus } from "@/lib/calendar/tripsStore";
import { deleteCalendarTripFs, subscribeCalendarTrips } from "@/lib/calendar/tripsFirestore";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import type { Reservation } from "@/lib/reservations/reservationStore";
import {
  subscribeActiveReservations,
  subscribeCancelledReservations,
  cancelReservationFirestore,
} from "@/lib/reservations/reservationsFirestore";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function vnMonthTitle(d: Date) {
  return `Tháng ${d.getMonth() + 1} ${d.getFullYear()}`;
}

function vnd(n: number) {
  return `${Math.round(n).toLocaleString("vi-VN")}₫`;
}

export default function CalendarPage() {
  const router = useRouter();
  const [month, setMonth] = React.useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = React.useState(() => {
    try {
      const raw = localStorage.getItem("getdriver.calendar.selectedDate.v1");
      return raw ? String(raw) : toYmd(new Date());
    } catch {
      return toYmd(new Date());
    }
  });
  const [trips, setTrips] = React.useState<Trip[]>([]);
  const [cancelledCodes, setCancelledCodes] = React.useState<Set<string>>(new Set());
  const [reservationCodes, setReservationCodes] = React.useState<Set<string>>(new Set());
  const [openBooking, setOpenBooking] = React.useState(false);
  const [booking, setBooking] = React.useState<Trip | null>(null);
  const [openCancel, setOpenCancel] = React.useState(false);
  const [cancelTrip, setCancelTrip] = React.useState<Trip | null>(null);

  React.useEffect(() => {
    try {
      localStorage.setItem("getdriver.calendar.selectedDate.v1", selected);
    } catch {
      // ignore
    }
  }, [selected]);

  React.useEffect(() => {
    let activeRows: Reservation[] = [];
    let cancelledSet = new Set<string>();
    let manualTrips: Trip[] = [];

    const recompute = () => {
      setReservationCodes(new Set(activeRows.map((x) => x.code)));
      const reservationTrips: Trip[] = activeRows
        .map((r) => ({
          id: r.code,
          date: dmyToIso(r.date),
          time: r.time,
          customer: r.customerName,
          from: r.pickup,
          to: r.dropoff,
          status:
            r.status === "Đã điều xe"
              ? ("Đang chạy" as TripStatus)
              : ("Đã đặt" as TripStatus),
          revenueVnd: r.currency === "VND" ? r.amount : 0,
          driverName: r.assignedDriver,
          driverPhone: r.assignedDriverPhone,
          vehicleType: r.vehicleType,
          vehiclePlate: r.assignedVehiclePlate,
        }))
        .filter((t) => Boolean(t.date));

      const nextManual = manualTrips.filter((t) => !reservationTrips.some((x) => x.id === t.id));
      setTrips([...reservationTrips, ...nextManual]);
      setCancelledCodes(new Set(cancelledSet));
    };

    const unsubA = subscribeActiveReservations((rows) => {
      activeRows = rows;
      recompute();
    });
    const unsubC = subscribeCancelledReservations((rows) => {
      cancelledSet = new Set(rows.map((x: any) => x.code));
      recompute();
    });
    const unsubT = subscribeCalendarTrips((rows) => {
      manualTrips = rows;
      recompute();
    });

    return () => {
      unsubA();
      unsubC();
      unsubT();
    };
  }, []);

  const monthTrips = trips
    .filter((t) => !cancelledCodes.has(t.id))
    .filter((t) => t.date.startsWith(toYmd(month).slice(0, 7)));
  const byDate = React.useMemo(() => {
    const m = new Map<string, Trip[]>();
    for (const t of monthTrips) {
      const arr = m.get(t.date) ?? [];
      arr.push(t);
      m.set(t.date, arr);
    }
    for (const [k, arr] of m) {
      arr.sort((a, b) => a.time.localeCompare(b.time));
      m.set(k, arr);
    }
    return m;
  }, [monthTrips]);

  const selectedTrips = byDate.get(selected) ?? [];

  const stats = React.useMemo(() => {
    const total = monthTrips.length;
    const completed = monthTrips.filter((t) => t.status === "Hoàn thành").length;
    const running = monthTrips.filter((t) => t.status === "Đang chạy").length;
    const revenue = monthTrips.reduce((sum, t) => sum + t.revenueVnd, 0);
    return { total, completed, running, revenue };
  }, [monthTrips]);

  return (
    <AppShell>
      <div className="flex-1 px-6 pb-10">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Lịch trình
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Xem và quản lý các chuyến đi theo ngày
              </p>
            </div>
            <Button variant="secondary" className="h-9 gap-2">
              <CalendarDays className="h-4 w-4" />
              Hôm nay
            </Button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <StatCard label="Tổng chuyến" value={stats.total} />
            <StatCard label="Hoàn thành" value={stats.completed} accent="emerald" />
            <StatCard label="Đang chạy" value={stats.running} accent="blue" />
            <StatCard label="Doanh thu" value={vnd(stats.revenue)} />
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {vnMonthTitle(month)}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    aria-label="Tháng trước"
                    onClick={() => setMonth((m) => addMonths(m, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    aria-label="Tháng sau"
                    onClick={() => setMonth((m) => addMonths(m, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <CalendarGrid
                month={month}
                selected={selected}
                hasTrips={(ymd) => (byDate.get(ymd)?.length ?? 0) > 0}
                statusFor={(ymd) => summarizeStatus(byDate.get(ymd) ?? [])}
                onSelect={(ymd) => setSelected(ymd)}
              />

              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                <LegendDot color="bg-blue-500" label="Đã đặt" />
                <LegendDot color="bg-amber-500" label="Đang chạy" />
                <LegendDot color="bg-emerald-500" label="Hoàn thành" />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Chọn ngày để xem
              </div>

              {selectedTrips.length === 0 ? (
                <div className="mt-10 flex flex-col items-center gap-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  <CalendarDays className="h-8 w-8" />
                  <div>Nhấn vào ngày trên lịch để xem danh sách chuyến</div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {selectedTrips.map((t) => (
                    <TripRow
                      key={t.id}
                      t={t}
                      canCancel={t.date >= toYmd(new Date())}
                      canEdit={reservationCodes.has(t.id)}
                      onEdit={() =>
                        router.push(`/reservation/new?code=${encodeURIComponent(t.id)}&from=calendar`)
                      }
                      onCancel={() => {
                        setCancelTrip(t);
                        setOpenCancel(true);
                      }}
                      onOpen={() => {
                        setBooking(t);
                        setOpenBooking(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <Dialog
        open={openCancel}
        onOpenChange={(v) => {
          setOpenCancel(v);
          if (!v) setCancelTrip(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Huỷ booking</DialogTitle>
            <DialogDescription>Bạn muốn huỷ booking này?</DialogDescription>
          </DialogHeader>
          <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
              {cancelTrip?.id ?? "—"}
            </div>
            <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">
              {cancelTrip?.customer ?? "—"}
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {cancelTrip ? `${cancelTrip.time} • ${cancelTrip.from} → ${cancelTrip.to}` : ""}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="h-10 w-1/2 rounded-md text-sm font-semibold text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              onClick={() => setOpenCancel(false)}
            >
              Từ chối
            </button>
            <button
              type="button"
              className="h-10 w-1/2 rounded-md bg-red-600 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              onClick={() => {
                if (!cancelTrip) return;
                if (reservationCodes.has(cancelTrip.id)) {
                  void cancelReservationFirestore(cancelTrip.id, { cancelledFrom: "calendar" });
                }
                void deleteCalendarTripFs(cancelTrip.id);
                setOpenCancel(false);
              }}
            >
              Xác nhận
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openBooking}
        onOpenChange={(v) => {
          setOpenBooking(v);
          if (!v) setBooking(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chi tiết Booking</DialogTitle>
            <DialogDescription>Thông tin chi tiết chuyến đi.</DialogDescription>
          </DialogHeader>

          {booking ? (
            <div className="space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <Detail label="Mã booking" value={booking.id} />
                <Detail label="Trạng thái" value={booking.status} />
                <Detail label="Ngày" value={booking.date} />
                <Detail label="Giờ" value={booking.time} />
              </div>
              <Detail label="Khách hàng" value={booking.customer} />
              <Detail label="Điểm đón" value={booking.from} />
              <Detail label="Điểm trả" value={booking.to} />
              <Detail label="Doanh thu" value={vnd(booking.revenueVnd)} />
              <div className="pt-2">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Tài xế
                </div>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <Detail label="Tên tài xế" value={booking.driverName ?? "—"} />
                  <Detail label="SĐT tài xế" value={booking.driverPhone ?? "—"} />
                  <Detail label="Biển số xe" value={booking.vehiclePlate ?? "—"} />
                  <Detail label="Loại xe" value={booking.vehicleType ?? "—"} />
                  <Detail label="Màu xe" value={booking.vehicleColor ?? "—"} />
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "blue" | "emerald";
}) {
  const color =
    accent === "blue"
      ? "text-blue-600"
      : accent === "emerald"
        ? "text-emerald-600"
        : "text-zinc-900 dark:text-zinc-50";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function summarizeStatus(trips: Trip[]): TripStatus | null {
  if (trips.length === 0) return null;
  if (trips.some((t) => t.status === "Đang chạy")) return "Đang chạy";
  if (trips.some((t) => t.status === "Đã đặt")) return "Đã đặt";
  return "Hoàn thành";
}

function CalendarGrid({
  month,
  selected,
  hasTrips,
  statusFor,
  onSelect,
}: {
  month: Date;
  selected: string;
  hasTrips: (ymd: string) => boolean;
  statusFor: (ymd: string) => TripStatus | null;
  onSelect: (ymd: string) => void;
}) {
  const first = startOfMonth(month);
  // Convert JS day (0=Sun) to VN header CN,T2.. => index 0..6
  const firstDow = first.getDay(); // 0..6
  const blanks = firstDow; // CN starts at 0
  const totalDays = daysInMonth(month);

  const cells: Array<{ ymd: string; day: number } | null> = [];
  for (let i = 0; i < blanks; i++) cells.push(null);
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(month.getFullYear(), month.getMonth(), day);
    cells.push({ ymd: toYmd(d), day });
  }

  const headers = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  return (
    <div className="mt-4">
      <div className="grid grid-cols-7 gap-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
        {headers.map((h) => (
          <div key={h} className="py-1">
            {h}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((c, idx) => {
          if (!c) return <div key={idx} className="h-12" />;
          const active = c.ymd === selected;
          const has = hasTrips(c.ymd);
          const status = statusFor(c.ymd);
          const dot =
            status === "Đã đặt"
              ? "bg-blue-500"
              : status === "Đang chạy"
                ? "bg-amber-500"
                : status === "Hoàn thành"
                  ? "bg-emerald-500"
                  : "";
          return (
            <button
              key={c.ymd}
              type="button"
              onClick={() => onSelect(c.ymd)}
              className={`relative h-12 rounded-lg border text-sm transition-colors ${
                active
                  ? "border-[#2E7AB0] bg-[#2E7AB0]/10 text-zinc-900 dark:text-zinc-50"
                  : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900/40"
              } ${has ? "" : "text-zinc-500"}`}
            >
              {c.day}
              {has ? (
                <span className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${dot}`} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TripRow({
  t,
  canCancel,
  canEdit,
  onEdit,
  onCancel,
  onOpen,
}: {
  t: Trip;
  canCancel: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onOpen: () => void;
}) {
  const badge =
    t.status === "Hoàn thành"
      ? "bg-emerald-100 text-emerald-700"
      : t.status === "Đang chạy"
        ? "bg-amber-100 text-amber-800"
        : "bg-blue-100 text-blue-700";
  return (
    <div
      onDoubleClick={onOpen}
      className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-left text-sm shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900/40"
      title="Double click để xem chi tiết"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-zinc-900 dark:text-zinc-50">
            {t.time} • {t.customer}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {t.from} → {t.to}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${badge}`}>
            {t.status}
          </span>
          {canEdit ? (
            <button
              type="button"
              className="h-8 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              Sửa
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              className="h-8 rounded-md bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Doanh thu: <b className="text-zinc-900 dark:text-zinc-50">{vnd(t.revenueVnd)}</b> • Mã: {t.id}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 font-medium text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function isoToDmy(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function dmyToIso(dmy: string) {
  const [d, m, y] = dmy.split("/");
  if (!y || !m || !d) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
