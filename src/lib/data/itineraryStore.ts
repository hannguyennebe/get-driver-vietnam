export type ItineraryPricingModel = "DISTANCE" | "FLAT_RATE" | "HOURLY";

export type Itinerary = {
  id: string;
  name: string;
  pricingModel?: ItineraryPricingModel;
  createdAt: number;
};

const KEY = "getdriver.data.itineraries.v1";

// GO LIVE: no demo seed
const SEED: Itinerary[] = [];

function safeParse(raw: string | null): Itinerary[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Itinerary[];
  } catch {
    return null;
  }
}

export function ensureItineraryStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify(SEED));
}

export function listItineraries(): Itinerary[] {
  ensureItineraryStore();
  return safeParse(localStorage.getItem(KEY)) ?? [];
}

export function upsertItinerary(next: Itinerary) {
  const all = listItineraries();
  const idx = all.findIndex((x) => x.id === next.id);
  const merged =
    idx >= 0 ? all.map((x) => (x.id === next.id ? next : x)) : [next, ...all];
  localStorage.setItem(KEY, JSON.stringify(merged));
}

export function deleteItinerary(id: string) {
  const all = listItineraries();
  localStorage.setItem(KEY, JSON.stringify(all.filter((x) => x.id !== id)));
}

export function generateItineraryId(existingIds: string[]) {
  const set = new Set(existingIds);
  for (let i = 0; i < 50; i++) {
    const id = `IT-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
    if (!set.has(id)) return id;
  }
  return `IT-${String(Date.now() % 1000).padStart(3, "0")}`;
}

