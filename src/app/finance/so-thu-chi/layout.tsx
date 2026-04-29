import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function CashbookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireViewPermission("finance.so-thu-chi");
  return children;
}

