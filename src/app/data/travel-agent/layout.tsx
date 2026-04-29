import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function TravelAgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireViewPermission("data.travel-agent");
  return children;
}

