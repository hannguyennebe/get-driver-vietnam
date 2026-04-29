import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function DispatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireViewPermission("dispatch");
  return children;
}

