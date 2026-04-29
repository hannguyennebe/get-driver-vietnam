export type DemoSession = {
  username: string;
  role: "Admin" | "Accountant" | "Sales" | "Operator" | "Driver";
  permissions?: {
    view: string[];
    edit: string[];
  };
  createdAt: number;
};

const KEY = "getdriver.demo.session";

export function setDemoSession(session: DemoSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function getDemoSession(): DemoSession | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoSession;
  } catch {
    return null;
  }
}

export function clearDemoSession() {
  localStorage.removeItem(KEY);
}

