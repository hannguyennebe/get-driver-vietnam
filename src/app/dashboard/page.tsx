"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { deleteCalendarTripFs, subscribeCalendarTrips } from "@/lib/calendar/tripsFirestore";
import type { Trip } from "@/lib/calendar/tripsStore";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Copy, Pencil } from "lucide-react";
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
  const initialDay = React.useMemo(() => toIsoDate(new Date()), []);
  /** Ngày theo đồng hồ máy (KPI, “hôm nay” thật). */
  const [realTodayIso, setRealTodayIso] = React.useState(initialDay);
  /** Ngày đang xem lịch trình (mũi tên). */
  const [viewDayIso, setViewDayIso] = React.useState(initialDay);
  const prevRealTodayRef = React.useRef(initialDay);
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
    const tick = () => {
      const next = toIsoDate(new Date());
      setRealTodayIso(next);
      setViewDayIso((v) => (v === prevRealTodayRef.current ? next : v));
      prevRealTodayRef.current = next;
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  React.useEffect(() => {
    const load = () => {
      const active = activeReservations as any[];
      const cancelled = cancelledReservations as any[];
      const trips = calendarTrips;

      const cancelledCodes = new Set(cancelled.map((x) => x.code));
      const reservationCodes = new Set(active.map((x) => x.code));

      const realDate = isoToDate(realTodayIso);
      const tomorrowIso =
        realDate != null ? toIsoDate(addDays(realDate, 1)) : toIsoDate(addDays(new Date(), 1));
      const monthPrefix = realTodayIso.slice(0, 7);

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
        .filter((r) => dmyToIso(r.date) === viewDayIso)
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
        .filter((t) => t.date === viewDayIso && !cancelledCodes.has(t.id))
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
        today: countUnionByIso(realTodayIso),
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
  }, [realTodayIso, viewDayIso, activeReservations, cancelledReservations, calendarTrips]);

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
      <div className="px-6 pb-8">
        <div className="pt-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Welcome to Get Driver Vietnam Operations Center
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-4 pb-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard
              title="Tổng Số Chuyến Hôm Nay"
              value={stats.today.toLocaleString("vi-VN")}
              tone="peach"
              className="min-w-0"
            />
            <KpiCard
              title="Tổng Số Chuyến Ngày Mai"
              value={stats.tomorrow.toLocaleString("vi-VN")}
              tone="peach2"
              className="min-w-0"
            />
            <KpiCard
              title="Tổng Số Chuyến Trong Tháng"
              value={stats.monthTotal.toLocaleString("vi-VN")}
              tone="gray"
              className="min-w-0"
            />
            <KpiCard
              title="Tổng Chuyến Cancellation Trong Tháng"
              value={stats.monthCancelled.toLocaleString("vi-VN")}
              tone="peach2"
              className="min-w-0"
            />
            <DonutCard
              title="Tỷ lệ tổng số chuyến"
              executed={stats.donut.executed}
              cancelled={stats.donut.cancelled}
              reservation={stats.donut.reservation}
              className="min-w-0"
            />
          </div>

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="grid w-full min-w-0 grid-cols-1 overflow-hidden rounded-xl border border-[#B8D4EA]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-zinc-600 sm:grid-cols-3 sm:divide-x sm:divide-[#B8D4EA]/50 dark:sm:divide-zinc-600">
              {/* Cột 1 — ngày: xanh nhẹ + mũi tên đổi ngày */}
              <div className="flex min-h-[76px] min-w-0 flex-col justify-center bg-gradient-to-br from-[#E8F4FC] via-[#EDF6FB] to-[#DCEEF9] px-3 py-3 sm:px-4 dark:from-[#152836]/90 dark:via-[#1a3048]/90 dark:to-[#132638]/90">
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#7eb3d4]/60 bg-white/70 text-[#1a5278] shadow-sm transition hover:bg-white hover:shadow dark:border-sky-700/50 dark:bg-[#1a3048]/80 dark:text-sky-100 dark:hover:bg-[#234a62]/90"
                    aria-label="Ngày trước"
                    onClick={() => setViewDayIso((v) => shiftIsoDays(v, -1))}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1 text-center">
                    <div className="text-sm font-semibold leading-snug text-[#1a5278] dark:text-sky-100">
                      {vnDmyTitleFromIso(viewDayIso)}
                    </div>
                    {viewDayIso !== realTodayIso ? (
                      <button
                        type="button"
                        className="mt-1 text-[11px] font-semibold text-[#2E7AB0] underline decoration-[#2E7AB0]/40 underline-offset-2 hover:text-[#256994] dark:text-sky-300"
                        onClick={() => setViewDayIso(realTodayIso)}
                      >
                        Về hôm nay
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#7eb3d4]/60 bg-white/70 text-[#1a5278] shadow-sm transition hover:bg-white hover:shadow dark:border-sky-700/50 dark:bg-[#1a3048]/80 dark:text-sky-100 dark:hover:bg-[#234a62]/90"
                    aria-label="Ngày sau"
                    onClick={() => setViewDayIso((v) => shiftIsoDays(v, 1))}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-2 text-center text-xs font-medium text-[#4a88aa] dark:text-sky-200/80">
                  Lịch trình
                </div>
              </div>
              {/* Cột 2 — số chuyến: trắng + nhấn xanh/vàng đất */}
              <div className="flex min-h-[76px] min-w-0 flex-col items-center justify-center gap-1 border-t border-[#B8D4EA]/50 bg-white px-4 py-3 dark:border-zinc-600 dark:bg-zinc-950 sm:border-t-0">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#7a9aae] dark:text-zinc-400">
                  Số chuyến trong ngày
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tabular-nums text-[#2E7AB0] dark:text-sky-300">
                    {dayTrips.length.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-sm font-semibold text-[#A67C2E] dark:text-[#D4B56A]">
                    chuyến
                  </span>
                </div>
              </div>
              {/* Cột 3 — RESERVATION: vàng đất */}
              <div className="flex min-h-[76px] min-w-0 items-center justify-center border-t border-[#c9a857]/40 bg-gradient-to-b from-[#EBCB7A] via-[#D4AE52] to-[#B88920] px-4 py-3 dark:border-amber-900/50 dark:from-[#6b5220] dark:via-[#5c461c] dark:to-[#4a3815] sm:border-t-0">
                <button
                  type="button"
                  className="w-full max-w-[220px] rounded-lg border border-[#A87912]/35 bg-white/25 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[#3d2f0d] shadow-sm backdrop-blur-[2px] transition hover:bg-white/40 hover:shadow-md active:translate-y-px dark:border-amber-900/40 dark:bg-black/20 dark:text-amber-50 dark:hover:bg-black/30 sm:max-w-none"
                  onClick={() => router.push("/reservation/new")}
                >
                  RESERVATION
                </button>
              </div>
            </div>

            {dayTrips.length === 0 ? (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
                Không có chuyến nào trong ngày này.
              </div>
            ) : (
              <div className="mt-4 -mx-5 overflow-x-auto px-5">
                <div className="flex gap-4">
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
                </div>
              </div>
            )}
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
    <div
      className={`flex h-full min-w-0 flex-col rounded-xl p-5 shadow-sm ${bg} ${className ?? ""}`}
    >
      <div className="text-xs leading-snug text-zinc-600 dark:text-zinc-400">{title}</div>
      <div className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
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
    <div
      className={`flex h-full min-w-0 flex-col rounded-xl bg-[#F6E1D6] p-5 shadow-sm dark:bg-[#3d2a22]/80 ${className ?? ""}`}
    >
      <div className="text-xs text-zinc-600 dark:text-zinc-300">{title}</div>
      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 xl:flex-col xl:items-center">
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

        <div className="w-full min-w-0 flex-1 space-y-2 text-xs text-zinc-700 dark:text-zinc-200 sm:w-auto xl:w-full">
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

function shiftIsoDays(iso: string, delta: number) {
  const d = isoToDate(iso);
  if (!d) return iso;
  return toIsoDate(addDays(d, delta));
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
  const [copiedAll, setCopiedAll] = React.useState(false);
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

  const copyAllInfo = async () => {
    const lines = [
      `RESERVATION ${trip.id}`,
      `Khách hàng: ${trip.customer || "—"}`,
      `Sales: ${trip.sales || "—"}`,
      `Giờ đón: ${trip.time || "—"}`,
      trip.itinerary ? `Hành trình: ${trip.itinerary}` : null,
      `Đón: ${trip.from || "—"}`,
      `Trả: ${trip.to || "—"}`,
      `Thu hộ: ${Math.round(trip.thuHoVnd ?? 0).toLocaleString("vi-VN")} đ`,
      `Ghi chú: ${trip.note?.trim() ? trip.note.trim() : "—"}`,
    ].filter((x): x is string => Boolean(x));
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 5000);
    } catch {
      // ignore (no toast/alert requested)
    }
  };

  return (
    <div className="w-[min(420px,85vw)] sm:w-[360px] lg:w-[380px] xl:w-[320px] shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
            onClick={copyAllInfo}
            title="Copy toàn bộ thông tin"
            aria-label="Copy toàn bộ thông tin"
          >
            {copiedAll ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
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

