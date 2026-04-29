import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function ContractsLayout({ children }: { children: React.ReactNode }) {
  await requireViewPermission("data.contracts");
  return children;
}

