import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function ItineraryLayout({ children }: { children: React.ReactNode }) {
  await requireViewPermission("data.itinerary");
  return children;
}

