import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function DriverWalletLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireViewPermission("finance.vi-tai-xe");
  return children;
}

