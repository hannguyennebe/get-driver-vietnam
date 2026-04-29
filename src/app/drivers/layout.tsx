import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function DriversLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireViewPermission("drivers");
  return children;
}

