import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function AccountsPayableLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireViewPermission("finance.phai-tra");
  return children;
}

