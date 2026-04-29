import { requireViewPermission } from "@/lib/auth/serverGuard";

export const runtime = "nodejs";

export default async function QuotationLayout({ children }: { children: React.ReactNode }) {
  await requireViewPermission("data.quotation");
  return children;
}

