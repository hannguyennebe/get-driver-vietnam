import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function ReservationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireViewPermission("data.reservations");
  return children;
}

