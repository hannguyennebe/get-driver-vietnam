export type TravelAgent = {
  id: string;
  name: string;
  businessModel?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  paymentType?: "Phải Trả" | "Công Nợ";
  taxIncluded?: boolean;
  paymentTerms?: PartnerPaymentTerms;
};

export type Supplier = {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  paymentType?: "Phải Trả" | "Công Nợ";
  paymentTerms?: PartnerPaymentTerms;
};

export type PartnerPaymentTerms =
  | { mode: "NEXT_DAY" }
  | { mode: "MONTHLY"; payDay: number; offsetMonths: number };

const KEY = "getdriver.data.partners.v1";

type Store = {
  travelAgents: TravelAgent[];
  suppliers: Supplier[];
};

const SEED: Store = {
  travelAgents: [
    {
      id: "TA-001",
      name: "Saigon Travel",
      businessModel: "B2B",
      contactName: "Ms. Linh",
      phone: "0909000001",
      email: "linh@saigontravel.vn",
      address: "TPHCM",
      website: "saigontravel.vn",
      paymentType: "Công Nợ",
      taxIncluded: true,
      paymentTerms: { mode: "MONTHLY", payDay: 10, offsetMonths: 1 },
    },
    {
      id: "TA-002",
      name: "VietTours",
      businessModel: "B2C",
      contactName: "Mr. Nam",
      phone: "0909000002",
      email: "nam@viettours.vn",
      address: "TPHCM",
      website: "viettours.vn",
      paymentType: "Phải Trả",
      taxIncluded: false,
      paymentTerms: { mode: "NEXT_DAY" },
    },
  ],
  suppliers: [
    {
      id: "SUP-001",
      name: "Garage Minh Phát",
      contactName: "Anh Phát",
      phone: "0909000101",
      email: "contact@minhphat.vn",
      paymentType: "Công Nợ",
      paymentTerms: { mode: "MONTHLY", payDay: 10, offsetMonths: 1 },
    },
    {
      id: "SUP-002",
      name: "Công ty Dầu Nhớt ABC",
      contactName: "Chị Hoa",
      phone: "0909000102",
      email: "sales@abcoil.vn",
      paymentType: "Phải Trả",
      paymentTerms: { mode: "NEXT_DAY" },
    },
  ],
};

function safeParse(raw: string | null): Store | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Store;
  } catch {
    return null;
  }
}

export function ensurePartnersStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify(SEED));
}

export function getPartners(): Store {
  ensurePartnersStore();
  return safeParse(localStorage.getItem(KEY)) ?? SEED;
}

export function normalizePartnerTerms(
  paymentType: "Phải Trả" | "Công Nợ" | undefined,
  terms: PartnerPaymentTerms | undefined,
): PartnerPaymentTerms {
  if (paymentType === "Phải Trả") return { mode: "NEXT_DAY" };
  if (paymentType === "Công Nợ") {
    if (terms?.mode === "MONTHLY") {
      return {
        mode: "MONTHLY",
        payDay: clampInt(terms.payDay, 1, 31, 10),
        offsetMonths: clampInt(terms.offsetMonths, 0, 24, 1),
      };
    }
    return { mode: "MONTHLY", payDay: 10, offsetMonths: 1 };
  }
  return terms ?? { mode: "NEXT_DAY" };
}

function clampInt(v: number, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function listTravelAgents(): TravelAgent[] {
  return getPartners().travelAgents ?? [];
}

export function listSuppliers(): Supplier[] {
  return getPartners().suppliers ?? [];
}

export function upsertTravelAgent(next: TravelAgent) {
  ensurePartnersStore();
  const store = getPartners();
  const normalized: TravelAgent = {
    ...next,
    paymentTerms: normalizePartnerTerms(next.paymentType, next.paymentTerms),
  };
  const idx = store.travelAgents.findIndex((x) => x.id === next.id);
  const travelAgents =
    idx >= 0
      ? store.travelAgents.map((x) => (x.id === normalized.id ? normalized : x))
      : [normalized, ...store.travelAgents];

  localStorage.setItem(KEY, JSON.stringify({ ...store, travelAgents }));
}

export function deleteTravelAgent(id: string) {
  ensurePartnersStore();
  const store = getPartners();
  const travelAgents = store.travelAgents.filter((x) => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify({ ...store, travelAgents }));
}

export function upsertSupplier(next: Supplier) {
  ensurePartnersStore();
  const store = getPartners();
  const normalized: Supplier = {
    ...next,
    paymentTerms: normalizePartnerTerms(next.paymentType, next.paymentTerms),
  };
  const idx = store.suppliers.findIndex((x) => x.id === next.id);
  const suppliers =
    idx >= 0
      ? store.suppliers.map((x) => (x.id === normalized.id ? normalized : x))
      : [normalized, ...store.suppliers];
  localStorage.setItem(KEY, JSON.stringify({ ...store, suppliers }));
}

export function deleteSupplier(id: string) {
  ensurePartnersStore();
  const store = getPartners();
  const suppliers = store.suppliers.filter((x) => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify({ ...store, suppliers }));
}

export function generateTravelAgentId(existingIds: string[]) {
  const set = new Set(existingIds);
  for (let i = 0; i < 50; i++) {
    const id = `TA-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    if (!set.has(id)) return id;
  }
  return `TA-${String(Date.now() % 1000).padStart(3, "0")}`;
}

export function generateSupplierId(existingIds: string[]) {
  const set = new Set(existingIds);
  for (let i = 0; i < 50; i++) {
    const id = `SUP-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    if (!set.has(id)) return id;
  }
  return `SUP-${String(Date.now() % 1000).padStart(3, "0")}`;
}

