"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { clearDemoSession, getDemoSession } from "@/lib/auth/demo";
import { Button } from "@/components/ui/button";
import { getCurrentUserIdentity } from "@/lib/auth/currentUser";
import {
  CalendarDays,
  ChevronDown,
  DollarSign,
  Database,
  LayoutDashboard,
  Truck,
  Users,
} from "lucide-react";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = React.useState<string | null>(null);
  const [role, setRole] = React.useState<string | null>(null);
  const [permissions, setPermissions] = React.useState<{
    view: string[];
    edit: string[];
  } | null>(null);
  const [openFleet, setOpenFleet] = React.useState(false);
  const [openData, setOpenData] = React.useState(false);
  const [openFinance, setOpenFinance] = React.useState(false);
  const [logoDataUrl, setLogoDataUrl] = React.useState<string>("");
  const logoInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const session = getDemoSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const ident = getCurrentUserIdentity();
    setUsername(ident?.name ?? session.username);
    setRole(session.role);
    setPermissions(session.permissions ?? { view: [], edit: [] });
  }, [router]);

  function canView(id: string) {
    if (role === "Admin") return true;
    return Boolean(permissions?.view?.includes(id));
  }

  function canViewAny(ids: string[]) {
    if (role === "Admin") return true;
    return ids.some((id) => canView(id));
  }

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("getdriver.brand.logo.v1");
      setLogoDataUrl(raw ? String(raw) : "");
    } catch {
      setLogoDataUrl("");
    }
  }, []);

  React.useEffect(() => {
    if (pathname?.startsWith("/drivers") || pathname?.startsWith("/vehicles")) {
      setOpenFleet(true);
    }
    if (pathname?.startsWith("/data")) {
      setOpenData(true);
    }
    if (pathname?.startsWith("/finance")) {
      setOpenFinance(true);
    }
  }, [pathname]);

  if (!username) return null;

  return (
    <div className="flex min-h-full flex-1 bg-zinc-50 dark:bg-black">
      <aside className="flex w-[260px] shrink-0 flex-col bg-[#2E7AB0] text-white">
        <div className="flex h-14 items-center gap-2 px-4">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-orange-500 text-xs font-bold"
            title="Double click để đổi logo"
            onDoubleClick={() => logoInputRef.current?.click()}
          >
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoDataUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              "GD"
            )}
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = String(reader.result || "");
                setLogoDataUrl(dataUrl);
                try {
                  localStorage.setItem("getdriver.brand.logo.v1", dataUrl);
                } catch {
                  // ignore
                }
              };
              reader.readAsDataURL(file);
              // allow re-upload same file
              e.currentTarget.value = "";
            }}
          />
          <div className="text-sm font-semibold">Get Driver Vietnam</div>
        </div>

        <nav className="mt-2 flex-1 px-2 text-[13px]">
          {canView("dashboard") ? (
            <SidebarItem
              icon={<LayoutDashboard className="h-4 w-4" />}
              label="Dashboard"
              href="/dashboard"
              active={pathname === "/dashboard"}
            />
          ) : null}
          {canView("dispatch") ? (
            <SidebarItem
              icon={<Truck className="h-4 w-4" />}
              label="Điều Xe"
              href="/dispatch"
              active={pathname === "/dispatch"}
            />
          ) : null}
          {canViewAny([
            "finance.thu",
            "finance.chi",
            "finance.vi-tai-xe",
            "finance.so-thu-chi",
          ]) ? (
            <SidebarGroup
              icon={<DollarSign className="h-4 w-4" />}
              label="Tài Chính"
              open={openFinance}
              onToggle={() => setOpenFinance((v) => !v)}
            >
              {canView("finance.thu") ? (
                <SidebarSubItem
                  href="/finance/thu"
                  label="Thu"
                  active={pathname === "/finance/thu"}
                />
              ) : null}
              {canView("finance.chi") ? (
                <SidebarSubItem
                  href="/finance/chi"
                  label="Chi"
                  active={pathname === "/finance/chi"}
                />
              ) : null}
              {canView("finance.vi-tai-xe") ? (
                <SidebarSubItem
                  href="/finance/vi-tai-xe"
                  label="Ví tài xế"
                  active={pathname === "/finance/vi-tai-xe"}
                />
              ) : null}
              {canView("finance.so-thu-chi") ? (
                <SidebarSubItem
                  href="/finance/so-thu-chi"
                  label="Sổ thu chi"
                  active={pathname === "/finance/so-thu-chi"}
                />
              ) : null}
            </SidebarGroup>
          ) : null}
          {canViewAny(["drivers", "vehicles"]) ? (
            <SidebarGroup
              icon={<Users className="h-4 w-4" />}
              label="Xe & Lái Xe"
              open={openFleet}
              onToggle={() => setOpenFleet((v) => !v)}
            >
              {canView("drivers") ? (
                <SidebarSubItem
                  href="/drivers"
                  label="Quản Lý Lái Xe"
                  active={pathname === "/drivers"}
                />
              ) : null}
              {canView("vehicles") ? (
                <SidebarSubItem
                  href="/vehicles"
                  label="Quản Lý Xe"
                  active={pathname === "/vehicles"}
                />
              ) : null}
            </SidebarGroup>
          ) : null}
          {canView("calendar") ? (
            <SidebarItem
              icon={<CalendarDays className="h-4 w-4" />}
              label="Calendar"
              href="/calendar"
              active={pathname === "/calendar"}
            />
          ) : null}
          {canViewAny([
            "data.reservations",
            "data.travel-agent",
            "data.supplier",
            "data.itinerary",
            "data.quotation",
            "data.contracts",
          ]) ? (
            <SidebarGroup
              icon={<Database className="h-4 w-4" />}
              label="Data"
              open={openData}
              onToggle={() => setOpenData((v) => !v)}
            >
              {canView("data.reservations") ? (
                <SidebarSubItem
                  href="/data/reservations"
                  label="Reservation List"
                  active={pathname === "/data/reservations"}
                />
              ) : null}
              {canView("data.travel-agent") ? (
                <SidebarSubItem
                  href="/data/travel-agent"
                  label="Travel Agent"
                  active={pathname === "/data/travel-agent"}
                />
              ) : null}
              {canView("data.supplier") ? (
                <SidebarSubItem
                  href="/data/supplier"
                  label="Supplier"
                  active={pathname === "/data/supplier"}
                />
              ) : null}
              {canView("data.itinerary") ? (
                <SidebarSubItem
                  href="/data/itinerary"
                  label="Hành Trình & Loại Xe"
                  active={pathname === "/data/itinerary"}
                />
              ) : null}
              {canView("data.quotation") ? (
                <SidebarSubItem
                  href="/data/quotation"
                  label="Báo Giá"
                  active={pathname === "/data/quotation"}
                />
              ) : null}
              {canView("data.contracts") ? (
                <SidebarSubItem
                  href="/data/contracts"
                  label="Hợp Đồng Nguyên Tắc"
                  active={pathname === "/data/contracts"}
                />
              ) : null}
            </SidebarGroup>
          ) : null}
        </nav>

        <div className="border-t border-white/15 px-3 pb-4 pt-4">
          {canViewAny(["admin.info", "admin.manage"]) ? (
            <Button
              className="w-full justify-start text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              onClick={() => router.push("/admin")}
            >
              Thông Tin &amp; Quản Trị
            </Button>
          ) : null}
          <Button
            className={`${role === "Admin" ? "mt-2 " : ""}w-full justify-start text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]`}
            onClick={() => {
              // Clear server session cookie (URL-typing protection)
              try {
                fetch("/api/auth/session", { method: "DELETE" });
              } catch {
                // ignore
              }
              clearDemoSession();
              router.replace("/login");
            }}
          >
            Logout
          </Button>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="flex h-14 items-center justify-end px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2E7AB0] text-xs font-semibold text-white">
              {initials(username)}
            </div>
            <div className="pr-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              {username}
            </div>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  href,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-white/90 hover:bg-white/10 ${
        active ? "bg-white/10" : ""
      }`}
    >
      <span className="text-white/90">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function SidebarGroup({
  icon,
  label,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  open?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-white/90 hover:bg-white/10"
        onClick={onToggle}
      >
        <span className="flex items-center gap-3">
          <span className="text-white/90">{icon}</span>
          <span>{label}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-white/70 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? <div className="mt-1 space-y-1 pl-10">{children}</div> : null}
    </div>
  );
}

function SidebarSubItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-2 text-[13px] text-white/85 hover:bg-white/10 ${
        active ? "bg-white/10" : ""
      }`}
    >
      {label}
    </Link>
  );
}

function initials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${a}${b}`.toUpperCase();
}

