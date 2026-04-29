import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function ThuLayout({ children }: { children: React.ReactNode }) {
  await requireViewPermission("finance.thu");
  return children;
}

