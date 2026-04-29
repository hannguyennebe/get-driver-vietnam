"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import {
  ensureQuotationStore,
  deleteQuotation,
  generateQuotationId,
  groupQuotations,
  listQuotations,
  upsertQuotation,
} from "@/lib/data/quotationStore";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ensurePartnersStore,
  listTravelAgents,
  type TravelAgent,
} from "@/lib/data/partnersStore";
import { ensureItineraryStore, listItineraries, type Itinerary } from "@/lib/data/itineraryStore";
import { ensureVehicleTypeStore, listVehicleTypes, type VehicleType } from "@/lib/data/vehicleTypeStore";
import { Trash2 } from "lucide-react";

export default function DataQuotationPage() {
  const [all, setAll] = React.useState<any[]>([]);
  const EARTH_BTN =
    "h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]";
  const [createKind, setCreateKind] = React.useState<"agent" | "year">("agent");
  const [openCreate, setOpenCreate] = React.useState(false);
  const [openPickTa, setOpenPickTa] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [travelAgents, setTravelAgentsState] = React.useState<TravelAgent[]>([]);
  const [pickedTa, setPickedTa] = React.useState<TravelAgent | null>(null);
  const [yearSel, setYearSel] = React.useState(() => String(new Date().getFullYear()));
  const [itineraries, setItineraries] = React.useState<Itinerary[]>([]);
  const [vehicleTypes, setVehicleTypes] = React.useState<VehicleType[]>([]);
  const [rows, setRows] = React.useState<
    Array<{ id: string; itinerary: string; prices: Record<string, string> }>
  >([]);

  const [pdfOpen, setPdfOpen] = React.useState(false);
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [pdfError, setPdfError] = React.useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = React.useState<string>("");
  const [pdfTitle, setPdfTitle] = React.useState<string>("");
  const [pdfFileName, setPdfFileName] = React.useState<string>("bang-bao-gia");
  const [pdfPendingShare, setPdfPendingShare] = React.useState(false);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<{ id: string; title: string } | null>(null);

  React.useEffect(() => {
    ensureQuotationStore();
    const load = () => setAll(listQuotations());
    load();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.includes("getdriver.data.quotations")) load();
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const refresh = React.useCallback(() => setAll(listQuotations()), []);

  React.useEffect(() => {
    ensureItineraryStore();
    const load = () => setItineraries(listItineraries());
    load();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.includes("getdriver.data.itineraries")) load();
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
    ensureVehicleTypeStore();
    const load = () => setVehicleTypes(listVehicleTypes());
    load();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
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

  const buildRowsFromItineraries = React.useCallback(() => {
    const itins = itineraries ?? [];
    const cols = sortedVehicleTypes ?? [];
    return itins.map((it) => {
      const prices: Record<string, string> = {};
      for (const c of cols) prices[c.id] = "";
      return { id: it.id, itinerary: it.name, prices };
    });
  }, [itineraries, sortedVehicleTypes]);

  React.useEffect(() => {
    // If vehicle types change while dialog is open, preserve existing values and add missing columns.
    if (!openCreate) return;
    const cols = sortedVehicleTypes ?? [];
    setRows((curr) =>
      (curr ?? []).map((r) => {
        const next: Record<string, string> = { ...(r.prices ?? {}) };
        for (const c of cols) if (next[c.id] == null) next[c.id] = "";
        // Drop removed columns
        for (const k of Object.keys(next)) if (!cols.some((c) => c.id === k)) delete next[k];
        return { ...r, prices: next };
      }),
    );
  }, [openCreate, sortedVehicleTypes]);

  React.useEffect(() => {
    ensurePartnersStore();
    const load = () => setTravelAgentsState(listTravelAgents());
    load();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.includes("getdriver.data.partners")) load();
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const commonRows = React.useMemo(() => {
    const rows = (all ?? []).filter(Boolean);
    return rows.filter((q: any) => {
      const gid = String(q.groupId ?? "");
      const gt = String(q.groupTitle ?? "");
      const isYear =
        /^Báo giá\s+\d{4}$/i.test(gt.trim()) ||
        /^Bảng Báo Giá Năm\s+\d{4}$/i.test(gt.trim()) ||
        /^Q-\d{4}$/i.test(gid.trim());
      return isYear || gt.trim() === "Báo giá 2026" || gid.startsWith("Q-2026");
    });
  }, [all]);

  const agentRows = React.useMemo(() => {
    const rows = (all ?? []).filter(Boolean);
    return rows.filter((q: any) => {
      const gid = String(q.groupId ?? "");
      const gt = String(q.groupTitle ?? "");
      const isCommon =
        /^Báo giá\s+\d{4}$/i.test(gt.trim()) ||
        /^Bảng Báo Giá Năm\s+\d{4}$/i.test(gt.trim()) ||
        /^Q-\d{4}$/i.test(gid.trim()) ||
        gid.startsWith("Q-2026") ||
        gt.trim() === "Báo giá 2026";
      return !isCommon;
    });
  }, [all]);

  const commonGroups = React.useMemo(() => groupQuotations(commonRows as any), [commonRows]);
  const agentGroups = React.useMemo(() => groupQuotations(agentRows as any), [agentRows]);

  const buildMatrixFromQuotation = React.useCallback((q: any) => {
    const lines: string[] = Array.isArray(q?.lines) ? q.lines : [];
    const cols = sortedVehicleTypes?.length
      ? sortedVehicleTypes.map((x) => x.name)
      : [];

    // Parse columns from lines if vehicle types are not available.
    const parsedColSet = new Set<string>();
    for (const ln of lines) {
      const parts = String(ln || "").split("|").map((x) => x.trim()).filter(Boolean);
      for (const p of parts.slice(1)) {
        const idx = p.indexOf(":");
        if (idx > 0) parsedColSet.add(p.slice(0, idx).trim());
      }
    }
    const columns = cols.length ? cols : Array.from(parsedColSet.values());

    const rows = lines
      .map((ln) => {
        const parts = String(ln || "").split("|").map((x) => x.trim()).filter(Boolean);
        const itinerary = parts[0] ?? "";
        const prices: Record<string, string | number> = {};
        for (const p of parts.slice(1)) {
          const idx = p.indexOf(":");
          if (idx <= 0) continue;
          const k = p.slice(0, idx).trim();
          const v = p.slice(idx + 1).trim();
          prices[k] = v;
        }
        return { itinerary, prices };
      })
      .filter((r) => String(r.itinerary || "").trim());

    return { columns, rows };
  }, [sortedVehicleTypes]);

  const generatePdfForQuotation = React.useCallback(
    async (q: any, mode: "preview" | "share") => {
      setPdfError(null);
      setPdfBusy(true);
      setPdfPendingShare(mode === "share");
      try {
        const title = String(q?.title || "Bảng báo giá").trim() || "Bảng báo giá";
        const fileName = title
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
          .replace(/[^a-zA-Z0-9\-_. ]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .slice(0, 80) || "bang-bao-gia";

        const now = new Date();
        const updatedDate = now.toLocaleDateString("vi-VN");
        const mx = buildMatrixFromQuotation(q);
        const res = await fetch("/api/quotation-template-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName,
            updatedDate,
            columns: mx.columns,
            rows: mx.rows,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.message ?? "Tạo PDF thất bại.");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setPdfTitle(title);
        setPdfFileName(fileName);
        setPdfOpen(true);
      } catch (e: any) {
        setPdfError(String(e?.message ?? e ?? "Không thể tạo PDF."));
      } finally {
        setPdfBusy(false);
      }
    },
    [buildMatrixFromQuotation],
  );

  return (
    <AppShell>
      <div className="flex-1 px-6 pb-10">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Quản lý Báo giá
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Danh sách báo giá theo nhóm.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  Báo Giá Chung
                </div>
                <button
                  type="button"
                  className={EARTH_BTN + " px-4"}
                  onClick={() => {
                    const y = new Date().getFullYear();
                    window.open(`/data/quotation/year?y=${y}`, "_blank", "noopener,noreferrer");
                  }}
                >
                  Tạo Báo Giá Năm
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {commonGroups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-300">
                    Chưa có báo giá chung.
                  </div>
                ) : (
                  commonGroups.map((g) => (
                    <div key={g.id} className="space-y-2">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {g.title}
                      </div>
                      <div className="grid gap-3">
                        {g.rows.map((r: any, idx: number) => (
                          <QuoteCard
                            key={r.id ?? idx}
                            title={r.title}
                            subtitle={`${g.rows.length} báo giá • ${(Array.isArray(r.lines) ? r.lines.length : 0) || 0} dòng`}
                            updatedAt={Number(r.updatedAt || 0) || 0}
                            onPreview={() => generatePdfForQuotation(r, "preview")}
                            onShare={() => generatePdfForQuotation(r, "share")}
                            onDelete={() => {
                              setConfirmDelete({ id: String(r.id ?? ""), title: String(r.title ?? "") });
                              setConfirmDeleteOpen(true);
                            }}
                            busy={pdfBusy}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  Danh Sách Báo Giá Đại Lý
                </div>
                <button
                  type="button"
                  className={EARTH_BTN + " px-4"}
                  onClick={() => {
                    const y = new Date().getFullYear();
                    window.open(`/data/quotation/agent?y=${y}`, "_blank", "noopener,noreferrer");
                  }}
                >
                  Tạo Báo Giá Đại Lý
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {agentGroups.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-300">
                    Chưa có báo giá đại lý.
                  </div>
                ) : (
                  agentGroups.map((g) => (
                    <div key={g.id} className="space-y-2">
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {g.title}
                      </div>
                      <div className="grid gap-3">
                        {g.rows.map((r: any, idx: number) => (
                          <QuoteCard
                            key={r.id ?? idx}
                            title={r.title}
                            subtitle={`${(Array.isArray(r.lines) ? r.lines.length : 0) || 0} dòng`}
                            updatedAt={Number(r.updatedAt || 0) || 0}
                            onPreview={() => generatePdfForQuotation(r, "preview")}
                            onShare={() => generatePdfForQuotation(r, "share")}
                            busy={pdfBusy}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{createKind === "year" ? "Tạo Báo Giá Năm" : "Tạo Báo Giá"}</DialogTitle>
            <DialogDescription>Nhập thông tin báo giá và lưu lại.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {createKind === "agent" ? (
              <div className="space-y-1">
                <div className="text-sm font-medium">Travel Agent</div>
                <button
                  type="button"
                  className="flex h-10 w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 text-left text-sm shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900/40"
                  onClick={() => setOpenPickTa(true)}
                >
                  <span className="truncate">
                    {pickedTa ? pickedTa.name : "Chọn Travel Agent"}
                  </span>
                  <span className="text-zinc-400">▾</span>
                </button>
                {pickedTa ? (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {pickedTa.contactName ?? "—"} • {pickedTa.phone ?? "—"} • {pickedTa.email ?? "—"}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-sm font-medium">Năm</div>
                <select
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-[#C79A2B] dark:border-zinc-800 dark:bg-zinc-950"
                  value={yearSel}
                  onChange={(e) => setYearSel(e.target.value)}
                >
                  {(() => {
                    const nowY = new Date().getFullYear();
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
            )}

            <div className="mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="max-h-[66vh] overflow-auto">
                <div className="min-w-full p-3">
                  <div className="flex w-max items-start gap-2">
                    {/* Itinerary column */}
                    <div className="w-[420px] shrink-0">
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

                    {/* Vehicle columns */}
                    {(sortedVehicleTypes.length ? sortedVehicleTypes : [{ id: "_", name: "—" } as any]).map(
                      (c: any) => (
                        <div key={c.id} className="w-[140px] shrink-0">
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
              <button type="button" className={EARTH_BTN + " px-4"} onClick={() => setOpenCreate(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={EARTH_BTN + " px-4"}
                onClick={() => {
                  setError(null);
                  const now = Date.now();
                  const { groupTitle, groupId, title } =
                    createKind === "year"
                      ? (() => {
                          const y = yearSel && yearSel.length === 4 ? yearSel : String(new Date().getFullYear());
                          return {
                            groupTitle: `Báo giá ${y}`,
                            groupId: `Q-${y}`,
                            title: `Báo giá ${y}`,
                          };
                        })()
                      : (() => {
                          if (!pickedTa) return { groupTitle: "", groupId: "", title: "" };
                          return {
                            groupTitle: pickedTa.name.trim() || "Travel Agent",
                            groupId: `Q-${sanitizeGroupId(pickedTa.name)}`,
                            title: `Báo giá - ${pickedTa.name}`.trim(),
                          };
                        })();
                  if (createKind === "agent" && !pickedTa) return setError("Vui lòng chọn Travel Agent.");
                  if (createKind === "year" && (!yearSel || yearSel.length !== 4)) return setError("Vui lòng nhập Năm (4 số).");
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
                  const id = generateQuotationId(listQuotations().map((x) => x.id));
                  upsertQuotation({
                    id,
                    groupId,
                    groupTitle,
                    title,
                    lines,
                    updatedAt: now,
                  });
                  setOpenCreate(false);
                }}
              >
                Lưu
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openPickTa} onOpenChange={setOpenPickTa}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chọn Travel Agent</DialogTitle>
            <DialogDescription>Chọn 1 Travel Agent để tạo báo giá.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[360px] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            {travelAgents.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500">Chưa có Travel Agent.</div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {travelAgents.map((ta) => (
                  <button
                    key={ta.id}
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                    onClick={() => {
                      setPickedTa(ta);
                      setOpenPickTa(false);
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {ta.name}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {ta.contactName ?? "—"} • {ta.phone ?? "—"} • {ta.email ?? "—"}
                      </div>
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                      {ta.id}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pdfOpen}
        onOpenChange={(v) => {
          setPdfOpen(v);
          if (!v) {
            setPdfPendingShare(false);
            setPdfError(null);
            setPdfTitle("");
            setPdfFileName("bang-bao-gia");
            setPdfUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return "";
            });
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>PDF báo giá</DialogTitle>
            <DialogDescription>{pdfTitle || "—"}</DialogDescription>
          </DialogHeader>

          {pdfError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {pdfError}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <a
              href={pdfUrl || "#"}
              download={`${pdfFileName}.pdf`}
              className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900/40"
            >
              Lưu
            </a>
            <button
              type="button"
              className="h-10 rounded-xl px-5 font-semibold text-white shadow-sm bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] hover:from-[#22B4EC] hover:to-[#0A6EA7] disabled:opacity-60"
              disabled={!pdfUrl}
              onClick={async () => {
                try {
                  if (!pdfUrl) return;
                  const res = await fetch(pdfUrl);
                  const blob = await res.blob();
                  const file = new File([blob], `${pdfFileName}.pdf`, { type: "application/pdf" });
                  const nav: any = navigator as any;
                  if (nav?.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
                    await nav.share({
                      title: "PDF báo giá",
                      text: pdfTitle ? `Báo giá: ${pdfTitle}` : "PDF báo giá",
                      files: [file],
                    });
                    return;
                  }
                } catch {
                  // fallthrough
                }
                try {
                  if (pdfUrl) {
                    await navigator.clipboard.writeText(pdfUrl);
                    alert("Thiết bị không hỗ trợ chia sẻ file. Đã copy link (blob url) vào clipboard.");
                  }
                } catch {
                  // ignore
                }
              }}
            >
              Chia sẻ
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            {pdfUrl ? (
              <iframe title="PDF preview" src={pdfUrl} className="h-[70vh] w-full" />
            ) : (
              <div className="p-4 text-sm text-zinc-600 dark:text-zinc-300">Chưa có PDF.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDeleteOpen}
        onOpenChange={(v) => {
          setConfirmDeleteOpen(v);
          if (!v) setConfirmDelete(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xoá báo giá?</DialogTitle>
            <DialogDescription>
              {confirmDelete?.title ? `Bạn chắc chắn muốn xoá “${confirmDelete.title}” ?` : "Bạn chắc chắn muốn xoá báo giá này?"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="h-9 rounded-xl px-4 text-sm font-semibold text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              onClick={() => {
                // Từ chối: không xoá và quay lại màn hình quản lý (đóng dialog)
                setConfirmDeleteOpen(false);
              }}
            >
              Từ chối
            </button>
            <button
              type="button"
              className="h-9 rounded-xl px-4 text-sm font-semibold text-white shadow-sm bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] hover:from-[#22B4EC] hover:to-[#0A6EA7]"
              onClick={() => {
                if (confirmDelete?.id) {
                  deleteQuotation(confirmDelete.id);
                  refresh();
                }
                setConfirmDeleteOpen(false);
              }}
            >
              Đồng ý
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function QuoteCard(opts: {
  title: string;
  subtitle: string;
  updatedAt: number;
  onPreview?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  const dt = opts.updatedAt ? new Date(opts.updatedAt) : null;
  return (
    <div className="relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {opts.title || "—"}
          </div>
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {opts.subtitle}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs text-zinc-500 dark:text-zinc-400">
          {dt ? (
            <>
              <div>{dt.toLocaleDateString("vi-VN")}</div>
              <div className="mt-0.5">{dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</div>
            </>
          ) : (
            "—"
          )}
        </div>
      </div>

      {opts.onDelete ? (
        <button
          type="button"
          className="absolute bottom-3 left-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
          title="Xoá báo giá"
          onClick={opts.onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}

      {opts.onPreview || opts.onShare ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {opts.onPreview ? (
            <button
              type="button"
              className="h-9 rounded-xl px-4 text-sm font-semibold text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912] disabled:opacity-60"
              disabled={Boolean(opts.busy)}
              onClick={opts.onPreview}
            >
              Xem trước
            </button>
          ) : null}
          {opts.onShare ? (
            <button
              type="button"
              className="h-9 rounded-xl px-4 text-sm font-semibold text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912] disabled:opacity-60"
              disabled={Boolean(opts.busy)}
              onClick={opts.onShare}
            >
              Chia sẻ
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function sanitizeGroupId(s: string) {
  const t = String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  return t.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "GROUP";
}

