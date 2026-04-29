import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Allow entering Finance if user can view any finance sub-module.
  await requireViewPermission([
    "finance.thu",
    "finance.chi",
    "finance.vi-tai-xe",
    "finance.so-thu-chi",
    "finance.thanh-toan",
    "finance.phai-tra",
    "finance.danh-muc-chi-van-phong",
  ]);
  return children;
}

