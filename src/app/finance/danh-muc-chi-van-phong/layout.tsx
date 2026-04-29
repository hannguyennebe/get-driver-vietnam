import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function OfficeExpenseCatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireViewPermission("finance.danh-muc-chi-van-phong");
  return children;
}

