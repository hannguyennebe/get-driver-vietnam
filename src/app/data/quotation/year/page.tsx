"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import {
  ensureQuotationStore,
  generateQuotationId,
  listQuotations,
  upsertQuotation,
} from "@/lib/data/quotationStore";
import { ensureItineraryStore, listItineraries, type Itinerary } from "@/lib/data/itineraryStore";
import { ensureVehicleTypeStore, listVehicleTypes, type VehicleType } from "@/lib/data/vehicleTypeStore";
import { useRouter, useSearchParams } from "next/navigation";

function YearQuotationInner() {
  const router = useRouter();
  const params = useSearchParams();
  const EARTH_BTN =
    "h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]";

  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [itineraries, setItineraries] = React.useState<Itinerary[]>([]);
  const [vehicleTypes, setVehicleTypes] = React.useState<VehicleType[]>([]);

  const nowY = new Date().getFullYear();
  const initY = params.get("y")?.replace(/[^\d]/g, "").slice(0, 4) || String(nowY);
  const [yearSel, setYearSel] = React.useState(initY);

  const sortedVehicleTypes = React.useMemo(() => {
    const vt = vehicleTypes ?? [];
    const seatsOf = (name: string) => {
      const m = String(name || "").match(/(\d{1,2})\s*ch/i);
      if (m?.[1]) return Number(m[1]) || 999;
      const m2 = String(name || "").match(/(\d{1,2})/);
      if (m2?.[1]) return Number(m2[1]) || 999;
      return 999;
    };
    return [...vt].sort((a, b) => seatsOf(a.name) - seatsOf(b.name) || a.name.localeCompare(b.name, "vi"));
  }, [vehicleTypes]);

  const [rows, setRows] = React.useState<Array<{ id: string; itinerary: string; prices: Record<string, string> }>>(
    [],
  );

  React.useEffect(() => {
    ensureQuotationStore();
    ensureItineraryStore();
    ensureVehicleTypeStore();

    const load = () => {
      setItineraries(listItineraries());
      setVehicleTypes(listVehicleTypes());
    };
    load();

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.includes("getdriver.data.itineraries")) load();
      if (e.key.includes("getdriver.data.vehicle-types")) load();
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  React.useEffect(() => {
    const cols = sortedVehicleTypes ?? [];
    const itins = itineraries ?? [];
    const next = itins.map((it) => {
      const prices: Record<string, string> = {};
      for (const c of cols) prices[c.id] = "";
      return { id: it.id, itinerary: it.name, prices };
    });
    setRows(next);
  }, [itineraries, sortedVehicleTypes]);

  return (
    <AppShell>
      <div className="flex-1 px-6 pb-10">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Tạo Báo Giá Năm
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Nhập thông tin báo giá và lưu lại.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="grid gap-3">
              <div className="space-y-1 max-w-sm">
                <div className="text-sm font-medium">Năm</div>
                <select
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-[#C79A2B] dark:border-zinc-800 dark:bg-zinc-950"
                  value={yearSel}
                  onChange={(e) => setYearSel(e.target.value)}
                >
                  {(() => {
                    const ys: number[] = [];
                    for (let y = nowY - 3; y <= nowY + 3; y++) ys.push(y);
                    return ys.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ));
                  })()}
                </select>
              </div>

              <div className="mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="max-h-[70vh] overflow-auto">
                  <div className="min-w-full p-3">
                    <div className="flex w-max items-start gap-2">
                      <div className="w-[460px] shrink-0">
                        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200">
                          HÀNH TRÌNH
                        </div>
                        <div className="mt-2 grid gap-3">
                          {rows.map((r) => (
                            <input
                              key={r.id}
                              value={r.itinerary}
                              readOnly
                              className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-[#C79A2B] dark:border-zinc-800 dark:bg-zinc-900/30"
                            />
                          ))}
                        </div>
                      </div>

                      {(sortedVehicleTypes.length ? sortedVehicleTypes : [{ id: "_", name: "—" } as any]).map(
                        (c: any) => (
                          <div key={c.id} className="w-[160px] shrink-0">
                            <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center text-xs font-semibold text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200">
                              {c.name}
                            </div>
                            <div className="mt-2 grid gap-3">
                              {rows.map((r) => (
                                <input
                                  key={`${r.id}:${c.id}`}
                                  value={sortedVehicleTypes.length ? r.prices?.[c.id] ?? "" : ""}
                                  readOnly={!sortedVehicleTypes.length}
                                  inputMode="numeric"
                                  onChange={(e) => {
                                    if (!sortedVehicleTypes.length) return;
                                    const v = e.target.value.replace(/[^\d]/g, "");
                                    setRows((s) =>
                                      s.map((x) =>
                                        x.id === r.id
                                          ? { ...x, prices: { ...(x.prices ?? {}), [c.id]: v } }
                                          : x,
                                      ),
                                    );
                                  }}
                                  className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-center text-sm outline-none focus:border-[#C79A2B] dark:border-zinc-800 dark:bg-zinc-900/30"
                                />
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className={EARTH_BTN + " px-4"}
                  onClick={() => router.push("/data/quotation")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className={EARTH_BTN + " px-4 disabled:opacity-60"}
                  onClick={() => {
                    setError(null);
                    if (!yearSel || yearSel.length !== 4) return setError("Vui lòng chọn Năm.");
                    const groupTitle = `Bảng Báo Giá Năm ${yearSel}`;
                    const groupId = `Q-${yearSel}`;
                    const title = `Bảng Báo Giá Năm ${yearSel}`;

                    const lines = rows
                      .map((r) => {
                        const itn = String(r.itinerary || "").trim();
                        if (!itn) return "";
                        const parts = sortedVehicleTypes.map((c) => {
                          const raw = r.prices?.[c.id] ?? "";
                          const v = raw ? Number(raw).toLocaleString("vi-VN") : "—";
                          return `${c.name}: ${v}`;
                        });
                        return `${itn} | ${parts.join(" | ")}`;
                      })
                      .filter(Boolean);

                    setSaving(true);
                    try {
                      const id = generateQuotationId(listQuotations().map((x) => x.id));
                      upsertQuotation({
                        id,
                        groupId,
                        groupTitle,
                        title,
                        lines,
                        updatedAt: Date.now(),
                      });
                      router.push("/data/quotation");
                    } catch {
                      setError("Không thể lưu báo giá. Vui lòng thử lại.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function YearQuotationPage() {
  return (
    <React.Suspense fallback={<AppShell><div className="flex-1 px-6 pb-10"><div className="pt-6" /></div></AppShell>}>
      <YearQuotationInner />
    </React.Suspense>
  );
}

