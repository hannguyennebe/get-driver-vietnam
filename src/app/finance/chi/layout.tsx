import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function ChiLayout({ children }: { children: React.ReactNode }) {
  await requireViewPermission("finance.chi");
  return children;
}

