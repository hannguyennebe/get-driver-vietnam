import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  await requireViewPermission("data.supplier");
  return children;
}

