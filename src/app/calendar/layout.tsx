import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireViewPermission("calendar");
  return children;
}

