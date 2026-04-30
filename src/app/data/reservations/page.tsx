"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import {
  type CancelledReservation,
  type Reservation,
} from "@/lib/reservations/reservationStore";
import { subscribeTravelAgents } from "@/lib/data/partnersFirestore";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  subscribeActiveReservations,
  subscribeCancelledReservations,
} from "@/lib/reservations/reservationsFirestore";

export default function DataReservationsPage() {
  const router = useRouter();
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [cancelled, setCancelled] = React.useState<CancelledReservation[]>([]);
  const [tab, setTab] = React.useState<"active" | "cancelled">("active");
  const [travelAgentNameById, setTravelAgentNameById] = React.useState<
    Record<string, string>
  >({});

  React.useEffect(() => {
    const unsubTa = subscribeTravelAgents((tas) =>
      setTravelAgentNameById(Object.fromEntries(tas.map((x) => [x.id, x.name]))),
    );
    const unsubA = subscribeActiveReservations(setReservations);
    const unsubC = subscribeCancelledReservations(setCancelled);

    return () => {
      unsubTa();
      unsubA();
      unsubC();
    };
  }, []);

  return (
    <AppShell>
      <div className="px-6 pb-10">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Reservation List
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Danh sách booking dùng để điều xe.
              </p>
            </div>

            <Button
              className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              onClick={() => router.push("/reservation/new")}
            >
              Reservation
            </Button>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("active")}
              className={`h-9 rounded-md border px-3 text-sm ${
                tab === "active"
                  ? "border-[#2E7AB0] bg-[#2E7AB0]/10 text-zinc-900 dark:text-zinc-50"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
              }`}
            >
              Reservation List ({reservations.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("cancelled")}
              className={`h-9 rounded-md border px-3 text-sm ${
                tab === "cancelled"
                  ? "border-[#2E7AB0] bg-[#2E7AB0]/10 text-zinc-900 dark:text-zinc-50"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
              }`}
            >
              Cancellation List ({cancelled.length})
            </button>
          </div>

          <ReservationsTable
            rows={tab === "active" ? reservations : cancelled}
            travelAgentNameById={travelAgentNameById}
            empty={
              tab === "active"
                ? "Chưa có booking nào."
                : "Chưa có booking nào bị huỷ."
            }
            showCancelledAt={tab === "cancelled"}
          />
        </div>
      </div>
    </AppShell>
  );
}

function ReservationsTable({
  rows,
  travelAgentNameById,
  empty,
  showCancelledAt,
}: {
  rows: Array<Reservation | CancelledReservation>;
  travelAgentNameById: Record<string, string>;
  empty: string;
  showCancelledAt?: boolean;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
          <tr>
            <th className="px-3 py-2">Booking ID</th>
            <th className="px-3 py-2">Tên khách</th>
            <th className="px-3 py-2">Điểm đón</th>
            <th className="px-3 py-2">Điểm trả</th>
            <th className="px-3 py-2">Ngày / Giờ</th>
            <th className="px-3 py-2">Hành trình</th>
            <th className="px-3 py-2">Loại xe</th>
            <th className="px-3 py-2 text-right">Giá</th>
            <th className="px-3 py-2">Travel Agent</th>
            <th className="px-3 py-2">Thanh toán</th>
            {showCancelledAt ? <th className="px-3 py-2">Huỷ lúc</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {rows.map((r) => (
            <tr key={r.code} className="bg-white dark:bg-zinc-950">
              <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
              <td className="px-3 py-2">{r.customerName}</td>
              <td className="px-3 py-2">{r.pickup}</td>
              <td className="px-3 py-2">{r.dropoff}</td>
              <td className="px-3 py-2">
                <div className="text-sm">{r.date}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {r.time}
                </div>
              </td>
              <td className="px-3 py-2">{r.itinerary || "—"}</td>
              <td className="px-3 py-2">{r.vehicleType || "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {(r.amount ?? 0).toLocaleString("vi-VN")} {r.currency ?? "VND"}
              </td>
              <td className="px-3 py-2">
                {r.travelAgentId
                  ? travelAgentNameById[r.travelAgentId] ?? r.travelAgentId
                  : "—"}
              </td>
              <td className="px-3 py-2">{r.paymentType ?? "—"}</td>
              {showCancelledAt ? (
                <td className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {"cancelledAt" in r
                    ? new Date(r.cancelledAt).toLocaleString("vi-VN")
                    : "—"}
                </td>
              ) : null}
            </tr>
          ))}

          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={showCancelledAt ? 11 : 10}
                className="px-3 py-8 text-center text-zinc-500"
              >
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

