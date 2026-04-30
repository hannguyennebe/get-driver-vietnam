"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateQuotationId,
  type Quotation,
} from "@/lib/data/quotationStore";
import type { TravelAgent } from "@/lib/data/partnersStore";
import { subscribeTravelAgents } from "@/lib/data/partnersFirestore";
import { subscribeQuotations, upsertQuotationFs } from "@/lib/data/quotationsFirestore";

type MatrixRow = {
  id: string;
  itinerary: string;
  prices: Record<string, string>; // key = column label, value = numeric string
};

function sanitizeGroupId(s: string) {
  const t = String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  return t.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "GROUP";
}

function isYearCommonQuote(q: Quotation) {
  const gid = String(q.groupId ?? "");
  const gt = String(q.groupTitle ?? "");
  return (
    /^Báo giá\s+\d{4}$/i.test(gt.trim()) ||
    /^Bảng Báo Giá Năm\s+\d{4}$/i.test(gt.trim()) ||
    /^Q-\d{4}$/i.test(gid.trim()) ||
    gid.startsWith("Q-2026") ||
    gt.trim() === "Báo giá 2026"
  );
}

function buildMatrixFromQuotation(q: Quotation, fallbackColumns: string[]) {
  const lines = Array.isArray(q?.lines) ? q.lines : [];

  const parsedColSet = new Set<string>();
  for (const ln of lines) {
    const parts = String(ln || "")
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean);
    for (const p of parts.slice(1)) {
      const idx = p.indexOf(":");
      if (idx > 0) parsedColSet.add(p.slice(0, idx).trim());
    }
  }

  const columns = fallbackColumns.length ? fallbackColumns : Array.from(parsedColSet.values());

  const rows: MatrixRow[] = lines
    .map((ln, idx) => {
      const parts = String(ln || "")
        .split("|")
        .map((x) => x.trim())
        .filter(Boolean);
      const itinerary = parts[0] ?? "";
      const prices: Record<string, string> = {};
      for (const c of columns) prices[c] = "";
      for (const p of parts.slice(1)) {
        const i = p.indexOf(":");
        if (i <= 0) continue;
        const k = p.slice(0, i).trim();
        const v = p.slice(i + 1).trim().replace(/[^\d]/g, "");
        if (!k) continue;
        prices[k] = v;
      }
      return { id: `row:${idx}`, itinerary, prices };
    })
    .filter((r) => String(r.itinerary || "").trim());

  return { columns, rows };
}

function fmtUpdatedAt(ts: number) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return "—";
  return `${d.toLocaleDateString("vi-VN")} ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

function getYearFromQuote(q: Quotation) {
  const m1 = String(q.groupId || "").match(/Q-(\d{4})/);
  if (m1?.[1]) return m1[1];
  const m2 = String(q.groupTitle || "").match(/(\d{4})/);
  if (m2?.[1]) return m2[1];
  const m3 = String(q.title || "").match(/(\d{4})/);
  if (m3?.[1]) return m3[1];
  return "";
}

function buildLines(rows: MatrixRow[], columns: string[]) {
  return rows
    .map((r) => {
      const itn = String(r.itinerary || "").trim();
      if (!itn) return "";
      const parts = columns.map((c) => {
        const raw = String(r.prices?.[c] ?? "").replace(/[^\d]/g, "");
        const v = raw ? Number(raw).toLocaleString("vi-VN") : "—";
        return `${c}: ${v}`;
      });
      return `${itn} | ${parts.join(" | ")}`;
    })
    .filter(Boolean);
}

function normalizeTitleForPdf(s: string) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

function makeAgentQuoteTitle(taName: string) {
  const name = normalizeTitleForPdf(taName);
  return `BẢNG BÁO GIÁ ${name || "TRAVEL AGENT"}`;
}

export default function AgentQuotationPage() {
  return (
    <React.Suspense
      fallback={
        <AppShell>
          <div className="flex-1 px-6 pb-10">
            <div className="pt-6" />
          </div>
        </AppShell>
      }
    >
      <AgentQuotationInner />
    </React.Suspense>
  );
}

function AgentQuotationInner() {
  const router = useRouter();
  const params = useSearchParams();
  const EARTH_BTN =
    "h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]";

  const [travelAgents, setTravelAgents] = React.useState<TravelAgent[]>([]);
  const [yearQuotes, setYearQuotes] = React.useState<Quotation[]>([]);
  const [allQuotes, setAllQuotes] = React.useState<Quotation[]>([]);
  const [taId, setTaId] = React.useState(params.get("taId") ?? "");
  const [sourceQuoteId, setSourceQuoteId] = React.useState(params.get("source") ?? "");

  const [columns, setColumns] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<MatrixRow[]>([]);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const unsubTa = subscribeTravelAgents((tas) => {
      setTravelAgents(tas);
      setTaId((prev) => prev || tas[0]?.id || "");
    });
    const unsubQ = subscribeQuotations((qs) => {
      setAllQuotes(qs);
      const yrs = qs.filter((q) => isYearCommonQuote(q));
      yrs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setYearQuotes(yrs);
      setSourceQuoteId((prev) => prev || yrs[0]?.id || "");
    });
    return () => {
      unsubTa();
      unsubQ();
    };
  }, []);

  const pickedTa = React.useMemo(
    () => travelAgents.find((x) => x.id === taId) ?? null,
    [travelAgents, taId],
  );

  const sourceQuote = React.useMemo(
    () => yearQuotes.find((x) => x.id === sourceQuoteId) ?? null,
    [yearQuotes, sourceQuoteId],
  );

  React.useEffect(() => {
    if (!sourceQuote) return;
    const fallbackCols: string[] = [];
    const mx = buildMatrixFromQuotation(sourceQuote, fallbackCols);
    setColumns(mx.columns);
    setRows(mx.rows);
  }, [sourceQuoteId, sourceQuote]);

  return (
    <AppShell>
      <div className="flex-1 px-6 pb-10">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Tạo Báo Giá Đại Lý
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Dữ liệu sẽ lấy từ Báo giá chung (Bảng Báo Giá Năm), bạn có thể sửa và xoá dòng không cần dùng.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">Travel Agent</div>
                <select
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-[#C79A2B] dark:border-zinc-800 dark:bg-zinc-950"
                  value={taId}
                  onChange={(e) => setTaId(e.target.value)}
                >
                  <option value="">—</option>
                  {travelAgents.map((ta) => (
                    <option key={ta.id} value={ta.id}>
                      {ta.name}
                    </option>
                  ))}
                </select>
                {pickedTa ? (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {pickedTa.contactName ?? "—"} • {pickedTa.phone ?? "—"} • {pickedTa.email ?? "—"}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">Nguồn dữ liệu (Báo giá chung)</div>
                <select
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-[#C79A2B] dark:border-zinc-800 dark:bg-zinc-950"
                  value={sourceQuoteId}
                  onChange={(e) => setSourceQuoteId(e.target.value)}
                >
                  <option value="">—</option>
                  {yearQuotes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} • {getYearFromQuote(q) || q.groupId} • {fmtUpdatedAt(q.updatedAt)}
                    </option>
                  ))}
                </select>
                {sourceQuote ? (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {sourceQuote.groupTitle} • {sourceQuote.id}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="max-h-[70vh] overflow-auto">
                <div className="min-w-full p-3">
                  <div className="flex w-max items-start gap-2">
                    <div className="w-[520px] shrink-0">
                      <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200">
                        HÀNH TRÌNH
                      </div>
                      <div className="mt-2 grid gap-3">
                        {rows.map((r) => (
                          <div key={r.id} className="flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
                              title="Xoá hành trình"
                              onClick={() => setRows((s) => s.filter((x) => x.id !== r.id))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <input
                              value={r.itinerary}
                              onChange={(e) =>
                                setRows((s) =>
                                  s.map((x) => (x.id === r.id ? { ...x, itinerary: e.target.value } : x)),
                                )
                              }
                              className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-[#C79A2B] dark:border-zinc-800 dark:bg-zinc-900/30"
                            />
                          </div>
                        ))}
                        {rows.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-300">
                            Chưa có dòng nào.
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {(columns.length ? columns : ["—"]).map((c) => (
                      <div key={c} className="w-[170px] shrink-0">
                        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-center text-xs font-semibold text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200">
                          {c}
                        </div>
                        <div className="mt-2 grid gap-3">
                          {rows.map((r) => (
                            <input
                              key={`${r.id}:${c}`}
                              value={r.prices?.[c] ?? ""}
                              inputMode="numeric"
                              onChange={(e) => {
                                const v = e.target.value.replace(/[^\d]/g, "");
                                setRows((s) =>
                                  s.map((x) =>
                                    x.id === r.id
                                      ? { ...x, prices: { ...(x.prices ?? {}), [c]: v } }
                                      : x,
                                  ),
                                );
                              }}
                              className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-center text-sm outline-none focus:border-[#C79A2B] dark:border-zinc-800 dark:bg-zinc-900/30"
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                className="h-9"
                onClick={() => router.push("/data/quotation")}
              >
                Quay lại
              </Button>
              <button
                type="button"
                disabled={saving}
                className={EARTH_BTN + " px-4 disabled:opacity-60"}
                onClick={() => {
                  setError(null);
                  if (!pickedTa) return setError("Vui lòng chọn Travel Agent.");
                  if (!columns.length) return setError("Không tìm thấy cột loại xe từ báo giá chung.");
                  if (!rows.length) return setError("Không có hành trình nào để lưu.");

                  setSaving(true);
                  try {
                    const id = generateQuotationId(allQuotes.map((x) => x.id));
                    const title = makeAgentQuoteTitle(pickedTa.name);
                    const groupTitle = pickedTa.name.trim() || "Travel Agent";
                    const groupId = `Q-${sanitizeGroupId(pickedTa.name)}`;
                    const lines = buildLines(rows, columns);
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
    </AppShell>
  );
}

