import { getDemoSession } from "@/lib/auth/demo";

export type DriverAdvance = {
  id: string;
  driverEmployeeCode: string;
  driverName: string;
  amountVnd: number;
  createdAt: number;
  createdDate: string; // dd/mm/yyyy
  createdTime: string; // HH:mm
  createdBy: string; // demo session username
};

const KEY = "getdriver.finance.driver-advances.v1";

function safeParse(raw: string | null): DriverAdvance[] | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DriverAdvance[];
  } catch {
    return null;
  }
}

export function ensureDriverAdvancesStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  localStorage.setItem(KEY, JSON.stringify([]));
}

export function listDriverAdvances(): DriverAdvance[] {
  ensureDriverAdvancesStore();
  return safeParse(localStorage.getItem(KEY)) ?? [];
}

export function addDriverAdvance(input: {
  driverEmployeeCode: string;
  driverName: string;
  amountVnd: number;
}) {
  ensureDriverAdvancesStore();
  const all = listDriverAdvances();
  const now = new Date();
  const session = getDemoSession();
  const next: DriverAdvance = {
    id: `DA-${String(Date.now())}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`,
    driverEmployeeCode: input.driverEmployeeCode,
    driverName: input.driverName,
    amountVnd: input.amountVnd,
    createdAt: Date.now(),
    createdDate: now.toLocaleDateString("vi-VN"),
    createdTime: now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    createdBy: session?.username ?? "—",
  };
  localStorage.setItem(KEY, JSON.stringify([next, ...all]));
  return next;
}

