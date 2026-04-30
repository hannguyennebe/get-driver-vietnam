"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { deleteCalendarTripFs, subscribeCalendarTrips } from "@/lib/calendar/tripsFirestore";
import type { Trip } from "@/lib/calendar/tripsStore";
import { useRouter } from "next/navigation";
import { Check, Copy, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  subscribeActiveReservations,
  subscribeCancelledReservations,
  cancelReservationFirestore,
} from "@/lib/reservations/reservationsFirestore";

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = React.useState(() => ({
    today: 0,
    tomorrow: 0,
    monthTotal: 0,
    monthCancelled: 0,
    donut: { executed: 0, cancelled: 0, reservation: 0 },
  }));
  const [todayIso, setTodayIso] = React.useState(() => toIsoDate(new Date()));
  const [latest, setLatest] = React.useState<
    Array<{
      code: string;
      customerName: string;
      pickup: string;
      dropoff: string;
      itinerary: string;
      createdAt: number;
      status: "Chờ điều xe" | "Đã điều xe";
    }>
  >([]);
  const [dayTrips, setDayTrips] = React.useState<Array<{
    id: string;
    kind: "reservation" | "calendar";
    customer: string;
    sales?: string;
    time: string;
    itinerary?: string;
    from: string;
    to: string;
    vehicleType?: string;
    reservationStatus?: "Chờ điều xe" | "Đã điều xe";
    driverName?: string;
    driverPhone?: string;
    vehiclePlate?: string;
    note?: string;
    thuHoVnd?: number;
  }>>([]);
  const [activeReservations, setActiveReservations] = React.useState<any[]>([]);
  const [cancelledReservations, setCancelledReservations] = React.useState<any[]>([]);
  const [calendarTrips, setCalendarTrips] = React.useState<Trip[]>([]);

  React.useEffect(() => {
    // Keep in sync with user's local timezone date (realtime; flips at midnight)
    const tick = () => setTodayIso(toIsoDate(new Date()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const load = () => {
      const active = activeReservations as any[];
      const cancelled = cancelledReservations as any[];
      const trips = calendarTrips;

      const cancelledCodes = new Set(cancelled.map((x) => x.code));
      const reservationCodes = new Set(active.map((x) => x.code));

      const tomorrowIso = toIsoDate(addDays(new Date(), 1));
      const monthPrefix = todayIso.slice(0, 7);

      const manualTrips = trips.filter((t) => !reservationCodes.has(t.id));

      const countUnionByIso = (iso: string) => {
        const res = active.filter((r) => dmyToIso(r.date) === iso).length;
        const manual = manualTrips.filter((t) => t.date === iso && !cancelledCodes.has(t.id)).length;
        return res + manual;
      };

      const countUnionByMonth = (prefix: string) => {
        const res = active.filter((r) => dmyToIso(r.date).startsWith(prefix)).length;
        const manual = manualTrips.filter((t) => t.date.startsWith(prefix) && !cancelledCodes.has(t.id)).length;
        return res + manual;
      };

      const monthCancelled = cancelled.filter((r) => dmyToIso(r.date).startsWith(monthPrefix)).length;

      const executed = trips.filter((t) => t.status === "Hoàn thành" && !cancelledCodes.has(t.id)).length;
      const donut = {
        executed,
        cancelled: cancelled.length,
        reservation: active.length,
      };

      const reservationDay = active
        .filter((r) => dmyToIso(r.date) === todayIso)
        .map((r) => ({
          id: r.code,
          kind: "reservation" as const,
          customer: r.customerName,
          sales: r.sales,
          time: r.time,
          itinerary: r.itinerary,
          from: r.pickup,
          to: r.dropoff,
          vehicleType: r.vehicleType,
          reservationStatus: r.status,
          driverName: r.assignedDriver,
          driverPhone: r.assignedDriverPhone,
          vehiclePlate: r.assignedVehiclePlate,
          note: r.note,
          thuHoVnd: r.thuHoCurrency === "VND" ? r.thuHoAmount : 0,
        }));
      const demoDay = manualTrips
        .filter((t) => t.date === todayIso && !cancelledCodes.has(t.id))
        .map((t) => ({
          id: t.id,
          kind: "calendar" as const,
          customer: t.customer,
          sales: "—",
          time: t.time,
          itinerary: undefined,
          from: t.from,
          to: t.to,
          vehicleType: t.vehicleType,
          reservationStatus: undefined,
          driverName: t.driverName,
          driverPhone: t.driverPhone,
          vehiclePlate: t.vehiclePlate,
          note: "",
          thuHoVnd: 0,
        }));
      const combined = [...reservationDay, ...demoDay].sort((a, b) => a.time.localeCompare(b.time));
      setDayTrips(combined);

      const latestRows = [...active]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .slice(0, 4)
        .map((r) => ({
          code: r.code,
          customerName: r.customerName,
          pickup: r.pickup,
          dropoff: r.dropoff,
          itinerary: r.itinerary,
          createdAt: r.createdAt ?? Date.now(),
          status: r.status,
        }));
      setLatest(latestRows);

      setStats({
        today: countUnionByIso(todayIso),
        tomorrow: countUnionByIso(tomorrowIso),
        monthTotal: countUnionByMonth(monthPrefix),
        monthCancelled,
        donut,
      });
    };

    load();
    return () => {
      // no-op
    };
  }, [todayIso, activeReservations, cancelledReservations, calendarTrips]);

  React.useEffect(() => {
    const unsubA = subscribeActiveReservations((rows) => setActiveReservations(rows as any));
    const unsubC = subscribeCancelledReservations((rows) =>
      setCancelledReservations(rows as any),
    );
    const unsubT = subscribeCalendarTrips(setCalendarTrips);
    return () => {
      unsubA();
      unsubC();
      unsubT();
    };
  }, []);

  return (
    <AppShell>
      <div className="flex-1 px-6 pb-8">
        <div className="pt-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Welcome to Get Driver Vietnam Operations Center
            </p>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-1">
            <KpiCard
              title="Tổng Số Chuyến Hôm Nay"
              value={stats.today.toLocaleString("vi-VN")}
              tone="peach"
              className="w-[260px] shrink-0"
            />
            <KpiCard
              title="Tổng Số Chuyến Ngày Mai"
              value={stats.tomorrow.toLocaleString("vi-VN")}
              tone="peach2"
              className="w-[260px] shrink-0"
            />
            <KpiCard
              title="Tổng Số Chuyến Trong Tháng"
              value={stats.monthTotal.toLocaleString("vi-VN")}
              tone="gray"
              className="w-[260px] shrink-0"
            />
            <KpiCard
              title="Tổng Chuyến Cancellation Trong Tháng"
              value={stats.monthCancelled.toLocaleString("vi-VN")}
              tone="peach2"
              className="w-[260px] shrink-0"
            />
            <DonutCard
              title="Tỷ lệ tổng số chuyến"
              executed={stats.donut.executed}
              cancelled={stats.donut.cancelled}
              reservation={stats.donut.reservation}
              className="w-[360px] shrink-0"
            />
          </div>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {vnDmyTitleFromIso(todayIso)}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Lịch trình hôm nay
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  {dayTrips.length.toLocaleString("vi-VN")} chuyến
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {dayTrips.map((t) => (
                <ScheduleCard
                  key={t.id}
                  trip={t}
                  onCancelConfirmed={() => {
                    if (t.kind === "reservation") {
                      void cancelReservationFirestore(t.id, { cancelledFrom: "reservation" });
                    } else {
                      void deleteCalendarTripFs(t.id);
                    }
                  }}
                  onEditBooking={() =>
                    router.push(`/reservation/new?code=${encodeURIComponent(t.id)}&from=dashboard`)
                  }
                  onEditDispatch={() =>
                    router.push(`/dispatch?code=${encodeURIComponent(t.id)}`)
                  }
                />
              ))}
              {dayTrips.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300 lg:col-span-2">
                  Không có chuyến nào trong ngày này.
                </div>
              ) : null}
            </div>

            <div className="mt-5">
              <button
                type="button"
                className="h-10 w-full rounded-md px-4 text-sm font-semibold text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                onClick={() => router.push("/reservation/new")}
              >
                RESERVATION
              </button>
            </div>
          </div>

          <LatestBookingsCard
            rows={latest}
            onGoAll={() => router.push("/data/reservations")}
            onConfirm={() => router.push("/dispatch")}
          />
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({
  title,
  value,
  tone,
  className,
}: {
  title: string;
  value: string;
  tone: "peach" | "peach2" | "gray";
  className?: string;
}) {
  const bg =
    tone === "gray"
      ? "bg-zinc-200"
      : tone === "peach2"
        ? "bg-[#F7E7DE]"
        : "bg-[#F6E1D6]";
  return (
    <div className={`rounded-xl p-5 shadow-sm ${bg} ${className ?? ""}`}>
      <div className="text-xs text-zinc-600">{title}</div>
      <div className="mt-3 text-2xl font-semibold text-zinc-900">{value}</div>
    </div>
  );
}

function DonutCard({
  title,
  executed,
  cancelled,
  reservation,
  className,
}: {
  title: string;
  executed: number;
  cancelled: number;
  reservation: number;
  className?: string;
}) {
  const total = executed + cancelled + reservation;
  const pct = (n: number) => (total <= 0 ? 0 : n / total);
  const segs = [
    { label: "Đã thực hiện", value: executed, color: "#19C37D" }, // green
    { label: "Đã huỷ", value: cancelled, color: "#EF4444" }, // red
    { label: "Reservation", value: reservation, color: "#F97316" }, // orange
  ];

  const size = 112;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;

  return (
    <div className={`rounded-xl bg-[#F6E1D6] p-5 shadow-sm ${className ?? ""}`}>
      <div className="text-xs text-zinc-600">{title}</div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="relative h-[112px] w-[112px] shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="#E5E7EB"
              strokeWidth={stroke}
              fill="none"
            />
            {segs.map((s, idx) => {
              const dash = c * pct(s.value);
              const dashArray = `${dash} ${c - dash}`;
              const dashOffset = c * (1 - offset);
              offset += pct(s.value);
              if (s.value <= 0) return null;
              return (
                <circle
                  key={idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={s.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeLinecap="butt"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-xs text-zinc-600">Tổng</div>
            <div className="text-lg font-semibold text-zinc-900">
              {total.toLocaleString("vi-VN")}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2 text-xs text-zinc-700">
          {segs.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: s.color }}
                />
                <span className="truncate">
                  {s.label}{" "}
                  <span className="text-zinc-500">
                    ({formatPct(pct(s.value))})
                  </span>
                </span>
              </div>
              <div className="shrink-0 font-semibold text-zinc-900">
                {s.value.toLocaleString("vi-VN")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function dmyToIso(dmy: string) {
  // dd/mm/yyyy -> yyyy-mm-dd
  const [d, m, y] = String(dmy || "").split("/");
  if (!d || !m || !y) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function formatPct(x: number) {
  if (!Number.isFinite(x) || x <= 0) return "0%";
  const p = x * 100;
  const s = p >= 10 ? p.toFixed(0) : p.toFixed(1);
  return `${s.replace(/\.0$/, "")}%`;
}

function LatestBookingsCard({
  rows,
  onGoAll,
  onConfirm,
}: {
  rows: Array<{
    code: string;
    customerName: string;
    pickup: string;
    dropoff: string;
    itinerary: string;
    createdAt: number;
    status: "Chờ điều xe" | "Đã điều xe";
  }>;
  onGoAll: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        <span aria-hidden>⚡</span>
        Booking Mới Nhất
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((r) => (
          <div
            key={r.code}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                {initials(r.customerName)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {r.customerName}
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    Mới
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {r.itinerary ? r.itinerary : `${r.pickup} → ${r.dropoff}`}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">
                  {timeAgo(r.createdAt)}
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                className="rounded-full bg-[#E9F4FF] px-3 py-1 text-xs font-semibold text-[#0B79B8] hover:bg-[#D7ECFF]"
                onClick={onConfirm}
              >
                Xác nhận
              </button>
            </div>
          </div>
        ))}

        {rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
            Chưa có booking nào.
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="mt-3 text-xs text-zinc-500 hover:text-[#0B79B8] dark:text-zinc-400"
        onClick={onGoAll}
      >
        Xem tất cả booking →
      </button>
    </div>
  );
}

function ScheduleCard({
  trip,
  onCancelConfirmed,
  onEditBooking,
  onEditDispatch,
}: {
  trip: {
    id: string;
    kind: "reservation" | "calendar";
    customer: string;
    sales?: string;
    time: string;
    itinerary?: string;
    from: string;
    to: string;
    vehicleType?: string;
    reservationStatus?: "Chờ điều xe" | "Đã điều xe";
    driverName?: string;
    driverPhone?: string;
    vehiclePlate?: string;
    note?: string;
    thuHoVnd?: number;
  };
  onCancelConfirmed: () => void;
  onEditBooking: () => void;
  onEditDispatch: () => void;
}) {
  const dispatched = trip.kind === "reservation" && trip.reservationStatus === "Đã điều xe";
  const [copied, setCopied] = React.useState(false);
  const [openCancel, setOpenCancel] = React.useState(false);

  const copyDriverInfo = async () => {
    const text =
      `👨‍✈️Driver : ${trip.driverName || "—"}\n` +
      `📞Phone: ${trip.driverPhone || "—"}\n` +
      `🚘CAR    : ${trip.vehicleType || "—"}\n` +
      `🚖CAR NUMBER : ${trip.vehiclePlate || "—"}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 5000);
    } catch {
      // ignore (no toast/alert requested)
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-2 bg-[#E9F4FF] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-[#D7ECFF] px-2 py-1 text-[10px] font-semibold text-[#0B79B8]">
            RESERVATION
          </span>
          <span className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
            {trip.id}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
            onClick={onEditBooking}
          >
            Sửa
          </button>
          <button
            type="button"
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
            onClick={() => setOpenCancel(true)}
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">Khách hàng</div>
            <div className="mt-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {trip.customer}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-500">SALES</div>
        <div className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
          {trip.sales ?? "—"}
        </div>

        <div className="mt-4 grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-zinc-500">Giờ đón</div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-50">{trip.time}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-zinc-500">Hành trình</div>
            <div className="text-xs text-zinc-700 dark:text-zinc-200">
              {trip.itinerary ? (
                <div className="font-semibold">{trip.itinerary}</div>
              ) : null}
              <div>Đón: {trip.from}</div>
              <div>Trả: {trip.to}</div>
            </div>
          </div>
        </div>

        {trip.kind === "reservation" ? (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              className={`h-10 flex-1 rounded-md px-4 text-sm font-semibold shadow-sm ${
                dispatched
                  ? "cursor-default bg-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                  : "text-zinc-900 bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              }`}
              onClick={() => {
                if (dispatched) return;
                onEditDispatch();
              }}
            >
              {dispatched ? "Đã Điều Xe" : "Điều xe"}
            </button>
            {dispatched ? (
              <button
                type="button"
                className="h-10 w-10 rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                aria-label="Sửa điều xe"
                onClick={onEditDispatch}
                title="Sửa điều xe"
              >
                <Pencil className="mx-auto h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm dark:bg-emerald-900/20">
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            THU HỘ
          </div>
          <div className="mt-1 font-semibold text-emerald-800 dark:text-emerald-200">
            {(trip.thuHoVnd ?? 0).toLocaleString("vi-VN")} đ
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            GHI CHÚ
          </div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            {trip.note?.trim() ? trip.note.trim() : "—"}
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/30">
          <div className="flex items-start justify-between gap-2">
            <div className="pt-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              Thông tin lái xe &amp; xe
            </div>
            <button
              type="button"
              className="-mt-1 -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              onClick={copyDriverInfo}
              title="Copy thông tin"
              aria-label="Copy thông tin"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="grid gap-2 text-xs text-zinc-700 dark:text-zinc-200">
            <div className="flex items-center justify-between gap-3">
              <div className="text-zinc-500">👨‍✈️Driver :</div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                {trip.driverName || "—"}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-zinc-500">📞Phone:</div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                {trip.driverPhone || "—"}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-zinc-500">🚘CAR    :</div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                {trip.vehicleType || "—"}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-zinc-500">🚖CAR NUMBER :</div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                {trip.vehiclePlate || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={openCancel} onOpenChange={setOpenCancel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Huỷ booking</DialogTitle>
            <DialogDescription>
              Bạn muốn huỷ booking này?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="font-mono text-xs text-zinc-600 dark:text-zinc-300">{trip.id}</div>
            <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">
              {trip.customer}
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
                onCancelConfirmed();
                setOpenCancel(false);
              }}
            >
              Xác nhận
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function vnDmyTitleFromIso(iso: string) {
  const d = isoToDate(iso);
  if (!d) return "—";
  const dow = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"][
    d.getDay()
  ];
  return `${dow}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function isoToDate(iso: string) {
  const [y, m, d] = String(iso || "").split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function isoToDmy(iso: string) {
  const [y, m, d] = String(iso || "").split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function initials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] ?? "—";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${a}${b}`.toUpperCase();
}

function timeAgo(ts: number) {
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

