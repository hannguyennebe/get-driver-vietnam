import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function PaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireViewPermission("finance.thanh-toan");
  return children;
}

