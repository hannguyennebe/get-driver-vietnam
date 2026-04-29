export type Quotation = {
  id: string;
  groupId: string;
  groupTitle: string;
  title: string;
  lines: string[];
  updatedAt: number;
};

const KEY = "getdriver.data.quotations.v1";

const SEED: Quotation[] = [];

function safeGet(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function safeSet(v: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // ignore
  }
}

export function ensureQuotationStore() {
  const raw = safeGet();
  if (!raw) {
    safeSet(JSON.stringify(SEED));
    return;
  }
  // Cleanup: remove old demo items if they exist in localStorage.
  try {
    const arr = JSON.parse(raw) as any[];
    if (!Array.isArray(arr)) return;
    const removedIds = new Set([
      "QT-2026-4S",
      "QT-2026-7S",
      "QT-INDO-AIRPORT",
      "QT-INDO-CITYTOUR",
    ]);
    const next = arr.filter((q) => !removedIds.has(String(q?.id ?? "")));
    if (next.length !== arr.length) safeSet(JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function listQuotations(): Quotation[] {
  const raw = safeGet();
  if (!raw) return [...SEED];
  try {
    const arr = JSON.parse(raw) as Quotation[];
    if (!Array.isArray(arr)) return [...SEED];
    return arr
      .filter(Boolean)
      .map((q) => ({
        ...q,
        id: String((q as any).id || ""),
        groupId: String((q as any).groupId || ""),
        groupTitle: String((q as any).groupTitle || ""),
        title: String((q as any).title || ""),
        lines: Array.isArray((q as any).lines) ? (q as any).lines.map((x: any) => String(x)) : [],
        updatedAt: Number((q as any).updatedAt || 0) || 0,
      }))
      .filter((q) => q.id && q.title);
  } catch {
    return [...SEED];
  }
}

export function getQuotation(id: string): Quotation | null {
  const qid = String(id || "").trim();
  if (!qid) return null;
  return listQuotations().find((q) => q.id === qid) ?? null;
}

export function groupQuotations(rows: Quotation[]) {
  const groups = new Map<string, { id: string; title: string; rows: Quotation[] }>();
  for (const q of rows) {
    const gid = q.groupId || "UNGROUPED";
    const gtitle = q.groupTitle || "Báo giá";
    const cur = groups.get(gid);
    if (!cur) groups.set(gid, { id: gid, title: gtitle, rows: [q] });
    else cur.rows.push(q);
  }
  const out = [...groups.values()];
  out.sort((a, b) => a.title.localeCompare(b.title));
  for (const g of out) g.rows.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

export function upsertQuotation(next: Quotation) {
  ensureQuotationStore();
  const all = listQuotations();
  const normalized: Quotation = {
    ...next,
    id: String(next.id || "").trim(),
    groupId: String(next.groupId || "").trim(),
    groupTitle: String(next.groupTitle || "").trim(),
    title: String(next.title || "").trim(),
    lines: Array.isArray(next.lines) ? next.lines.map((x) => String(x ?? "").trim()).filter(Boolean) : [],
    updatedAt: Number(next.updatedAt || 0) || Date.now(),
  };
  if (!normalized.id || !normalized.title) return;
  const idx = all.findIndex((q) => q.id === normalized.id);
  const out = idx >= 0 ? all.map((q) => (q.id === normalized.id ? normalized : q)) : [normalized, ...all];
  safeSet(JSON.stringify(out));
}

export function deleteQuotation(id: string) {
  ensureQuotationStore();
  const qid = String(id || "").trim();
  if (!qid) return;
  const out = listQuotations().filter((q) => q.id !== qid);
  safeSet(JSON.stringify(out));
}

export function generateQuotationId(existingIds: string[]) {
  const set = new Set((existingIds ?? []).map((x) => String(x || "").trim()).filter(Boolean));
  for (let i = 0; i < 50; i++) {
    const id = `QT-${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`;
    if (!set.has(id)) return id;
  }
  return `QT-${Date.now()}`;
}

