export type UserRole = "Admin" | "Accountant" | "Sales" | "Operator" | "Driver";

export type UserPermissions = {
  view: string[];
  edit: string[];
};

export type AdminUser = {
  uid?: string;
  employeeCode: string; // e.g. "12345"
  name: string;
  phone: string; // +84...
  role: UserRole;
  password: string;
  active: boolean;
  permissions: UserPermissions;
  createdAt: number;
  updatedAt: number;
};

type StoreShape = {
  admin: {
    phone: string;
    password: string;
  };
  users: AdminUser[];
};

const KEY = "getdriver.admin.store.v1";

const DEFAULT_ADMIN = {
  phone: "+84999999999",
  password: "admin123",
} as const;

const DEFAULT_PERMS: UserPermissions = { view: [], edit: [] };

function safeParse(raw: string | null): StoreShape | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoreShape;
  } catch {
    return null;
  }
}

export function ensureAdminStore() {
  const existing = safeParse(localStorage.getItem(KEY));
  if (existing) return;
  const now = Date.now();
  const seed: StoreShape = {
    admin: { ...DEFAULT_ADMIN },
    users: [
      {
        employeeCode: "00001",
        name: "Nguyễn Văn A",
        phone: "+84901234567",
        role: "Operator",
        password: "123456",
        active: true,
        permissions: { ...DEFAULT_PERMS },
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
  localStorage.setItem(KEY, JSON.stringify(seed));
}

export function getAdminCredentials() {
  ensureAdminStore();
  const store = safeParse(localStorage.getItem(KEY));
  return store?.admin ?? DEFAULT_ADMIN;
}

export function validateDemoLogin(phone: string, password: string): UserRole | null {
  ensureAdminStore();
  const store = safeParse(localStorage.getItem(KEY));
  if (!store) return null;

  if (store.admin.phone === phone && store.admin.password === password) {
    return "Admin";
  }

  const user = store.users.find((u) => u.phone === phone);
  if (!user) return null;
  if (!user.active) return null;
  if (user.password !== password) return null;
  return user.role;
}

export function listUsers(): AdminUser[] {
  ensureAdminStore();
  const store = safeParse(localStorage.getItem(KEY));
  return store?.users ?? [];
}

export function upsertUser(user: AdminUser) {
  ensureAdminStore();
  const store = safeParse(localStorage.getItem(KEY));
  if (!store) return;
  const idx = store.users.findIndex((u) => u.employeeCode === user.employeeCode);
  if (idx >= 0) store.users[idx] = user;
  else store.users.unshift(user);
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function deleteUser(employeeCode: string) {
  ensureAdminStore();
  const store = safeParse(localStorage.getItem(KEY));
  if (!store) return;
  store.users = store.users.filter((u) => u.employeeCode !== employeeCode);
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function generateEmployeeCode(existingCodes: string[]) {
  const set = new Set(existingCodes);
  for (let i = 0; i < 50; i++) {
    const code = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
    if (!set.has(code)) return code;
  }
  // fallback
  let n = 1;
  while (set.has(String(n).padStart(5, "0"))) n++;
  return String(n).padStart(5, "0");
}

export const PERMISSION_CATALOG = [
  { id: "dashboard", label: "Dashboard" },
  { id: "calendar", label: "Calendar" },
  { id: "dispatch", label: "Điều Xe" },
  { id: "drivers", label: "Xe & Lái Xe / Quản Lý Lái Xe" },
  { id: "vehicles", label: "Xe & Lái Xe / Quản Lý Xe" },
  { id: "finance.thu", label: "Tài Chính / Thu" },
  { id: "finance.chi", label: "Tài Chính / Chi" },
  { id: "finance.vi-tai-xe", label: "Tài Chính / Ví tài xế" },
  { id: "finance.so-thu-chi", label: "Tài Chính / Sổ thu chi" },
  { id: "data.reservations", label: "Data / Reservation List" },
  { id: "data.travel-agent", label: "Data / Travel Agent" },
  { id: "data.supplier", label: "Data / Supplier" },
  { id: "data.itinerary", label: "Data / Hành Trình & Loại Xe" },
  { id: "data.quotation", label: "Data / Báo Giá" },
  { id: "data.contracts", label: "Data / Hợp Đồng Nguyên Tắc" },
  { id: "admin.info", label: "Thông Tin & Quản Trị / Thông Tin" },
  { id: "admin.manage", label: "Thông Tin & Quản Trị / Quản Trị (Users)" },
] as const;

