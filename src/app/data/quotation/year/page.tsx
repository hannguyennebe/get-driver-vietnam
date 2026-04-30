"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import {
  generateQuotationId,
  type Quotation,
} from "@/lib/data/quotationStore";
import type { Itinerary } from "@/lib/data/itineraryStore";
import type { VehicleType } from "@/lib/data/vehicleTypeStore";
import { subscribeItineraries } from "@/lib/data/itineraryFirestore";
import { subscribeVehicleTypes } from "@/lib/data/vehicleTypeFirestore";
import { subscribeQuotations, upsertQuotationFs } from "@/lib/data/quotationsFirestore";
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
  const [allQuotes, setAllQuotes] = React.useState<Quotation[]>([]);

  const nowY = new Date().getFullYear();
  const initY = params.get("y")?.replace(/[^\d]/g, "").slice(0, 4) || String(nowY);
  const [yearSel, setYearSel] = React.useState(initY);
  const [rowsKey, setRowsKey] = React.useState(initY);

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

  const itineraryOrder = React.useCallback((it: Itinerary) => {
    const m = String((it as any)?.pricingModel ?? "DISTANCE").toUpperCase();
    if (m === "DISTANCE") return 0;
    if (m === "FLAT_RATE" || m === "FLATRATE") return 1;
    if (m === "HOURLY") return 2;
    return 9;
  }, []);

  const [rows, setRows] = React.useState<Array<{ id: string; itinerary: string; prices: Record<string, string> }>>(
    [],
  );

  const activeQuote = React.useMemo(() => {
    const gid = `Q-${yearSel}`;
    const candidates = (allQuotes ?? [])
      .filter(Boolean)
      .filter((q) => String((q as any)?.groupId ?? "") === gid)
      .filter((q) => String((q as any)?.groupTitle ?? "").toLowerCase().includes("bảng báo giá năm"));
    candidates.sort((a, b) => (Number((b as any)?.updatedAt ?? 0) || 0) - (Number((a as any)?.updatedAt ?? 0) || 0));
    return candidates[0] ?? null;
  }, [allQuotes, yearSel]);

  const missingItinerariesCount = React.useMemo(() => {
    const ids = new Set((itineraries ?? []).map((x) => x.id));
    const present = new Set((rows ?? []).map((r) => r.id));
    let missing = 0;
    for (const id of ids) if (!present.has(id)) missing++;
    return missing;
  }, [itineraries, rows]);

  function parseItineraryCell(raw: string) {
    const s = String(raw || "").trim();
    const idx = s.indexOf("::");
    if (idx > 0) {
      const id = s.slice(0, idx).trim();
      const name = s.slice(idx + 2).trim();
      return { id, name };
    }
    return { id: "", name: s };
  }

  function parseQuotePriceMap(q: Quotation | null) {
    const map = new Map<string, Record<string, string>>();
    const lines: string[] = Array.isArray((q as any)?.lines) ? ((q as any).lines as any) : [];
    const itinByName = new Map<string, string>();
    for (const it of itineraries ?? []) itinByName.set(String(it.name || "").trim(), it.id);
    for (const ln of lines) {
      const parts = String(ln || "").split("|").map((x) => x.trim()).filter(Boolean);
      const itRaw = parts[0] ?? "";
      const parsed = parseItineraryCell(itRaw);
      const id = parsed.id || itinByName.get(parsed.name) || "";
      if (!id) continue;
      const rec: Record<string, string> = {};
      for (const p of parts.slice(1)) {
        const i = p.indexOf(":");
        if (i <= 0) continue;
        const k = p.slice(0, i).trim();
        const v = p.slice(i + 1).trim();
        rec[k] = v;
      }
      map.set(id, rec);
    }
    return map;
  }

  React.useEffect(() => {
    const unsubIt = subscribeItineraries(setItineraries);
    const unsubVt = subscribeVehicleTypes(setVehicleTypes);
    const unsubQ = subscribeQuotations(setAllQuotes);
    return () => {
      unsubIt();
      unsubVt();
      unsubQ();
    };
  }, []);

  React.useEffect(() => {
    // Reset local rows when switching year (so we don't mix edits across years).
    if (rowsKey !== yearSel) {
      setRowsKey(yearSel);
      setRows([]);
    }
  }, [rowsKey, yearSel]);

  React.useEffect(() => {
    const cols = sortedVehicleTypes ?? [];
    const itins = itineraries ?? [];
    const sorted = [...itins].sort(
      (a, b) => itineraryOrder(a) - itineraryOrder(b) || a.name.localeCompare(b.name, "vi"),
    );
    const quoteMap = parseQuotePriceMap(activeQuote);
    const vtNameById = new Map(cols.map((c) => [c.id, c.name]));
    setRows((curr) => {
      const byId = new Map((curr ?? []).map((r) => [r.id, r]));
      const next = sorted.map((it) => {
        const base: Record<string, string> = {};
        for (const c of cols) base[c.id] = "";
        const existing = byId.get(it.id);
        if (existing) {
          // Preserve any in-progress edits; just update itinerary display name.
          return { ...existing, itinerary: it.name, prices: { ...base, ...(existing.prices ?? {}) } };
        }
        const rec = quoteMap.get(it.id);
        if (rec) {
          for (const c of cols) {
            const label = vtNameById.get(c.id) ?? c.name;
            const raw = String(rec[label] ?? "").replace(/[^\d]/g, "");
            base[c.id] = raw;
          }
        }
        return { id: it.id, itinerary: it.name, prices: base };
      });
      return next;
    });
  }, [activeQuote, itineraries, sortedVehicleTypes, itineraryOrder]);

  const groupedRows = React.useMemo(() => {
    const by = { DISTANCE: [] as typeof rows, FLAT_RATE: [] as typeof rows, HOURLY: [] as typeof rows };
    const byId = new Map((itineraries ?? []).map((it) => [it.id, String((it as any)?.pricingModel ?? "DISTANCE").toUpperCase()]));
    for (const r of rows ?? []) {
      const m = byId.get(r.id) ?? "DISTANCE";
      if (m === "HOURLY") by.HOURLY.push(r);
      else if (m === "FLAT_RATE" || m === "FLATRATE") by.FLAT_RATE.push(r);
      else by.DISTANCE.push(r);
    }
    return by;
  }, [rows, itineraries]);

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

              {missingItinerariesCount > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  Có {missingItinerariesCount} hành trình mới chưa có trong bảng. Bảng sẽ tự cập nhật sau vài giây; nếu chưa thấy, bạn hãy đổi năm qua lại hoặc refresh trang.
                </div>
              ) : null}

              <div className="mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="max-h-[70vh] overflow-auto">
                  <div className="min-w-full p-3">
                    {(
                      [
                        ["DISTANCE", "DISTANCE"],
                        ["FLAT_RATE", "FLAT RATE"],
                        ["HOURLY", "HOURLY"],
                      ] as const
                    ).map(([key, label]) => {
                      const secRows = (groupedRows as any)[key] as typeof rows;
                      if (!secRows?.length) return null;
                      return (
                        <div key={key} className="mb-6">
                          <div className="mb-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                            {label}
                          </div>
                          <div className="flex w-max items-start gap-2">
                            <div className="w-[460px] shrink-0">
                              <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200">
                                HÀNH TRÌNH
                              </div>
                              <div className="mt-2 grid gap-3">
                                {secRows.map((r) => (
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
                                <div key={`${key}:${c.id}`} className="w-[160px] shrink-0">
                                  <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center text-xs font-semibold text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200">
                                    {c.name}
                                  </div>
                                  <div className="mt-2 grid gap-3">
                                    {secRows.map((r) => (
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
                      );
                    })}
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
                        const itKey = `${r.id}::${itn}`;
                        const parts = sortedVehicleTypes.map((c) => {
                          const raw = r.prices?.[c.id] ?? "";
                          const v = raw ? Number(raw).toLocaleString("vi-VN") : "—";
                          return `${c.name}: ${v}`;
                        });
                        return `${itKey} | ${parts.join(" | ")}`;
                      })
                      .filter(Boolean);

                    setSaving(true);
                    try {
                      const id = String((activeQuote as any)?.id ?? "").trim() || generateQuotationId(allQuotes.map((x) => x.id));
                      void upsertQuotationFs({
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

