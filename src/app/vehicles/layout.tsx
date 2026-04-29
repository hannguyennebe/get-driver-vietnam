import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function VehiclesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireViewPermission("vehicles");
  return children;
}

