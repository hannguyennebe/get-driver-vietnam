import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function ReservationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reservation creation/edit lives under Data -> Reservations permission.
  await requireViewPermission("data.reservations");
  return children;
}

