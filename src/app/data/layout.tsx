import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function DataLayout({ children }: { children: React.ReactNode }) {
  await requireViewPermission([
    "data.reservations",
    "data.travel-agent",
    "data.supplier",
    "data.itinerary",
    "data.quotation",
    "data.contracts",
  ]);
  return children;
}

