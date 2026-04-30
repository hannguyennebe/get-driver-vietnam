"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Home, Pencil, Phone, Share2, Trash2, User, Wallet } from "lucide-react";
import type { CashbookEntry } from "@/lib/finance/cashbookStore";
import { addCashbookEntryFs, subscribeCashbookEntries } from "@/lib/finance/cashbookFirestore";
import { getPaymentInfo } from "@/lib/admin/paymentStore";
import {
  generateEmployeeCode,
  type Driver,
  type DriverType,
} from "@/lib/fleet/driverStore";
import {
  odCodeFromExternal,
  type DriverWallet,
} from "@/lib/fleet/driverWalletStore";
import { deleteDriverFs, subscribeDrivers, upsertDriverFs } from "@/lib/fleet/driversFirestore";
import {
  adjustDriverWalletBalanceFs,
  ensureWalletForExternalDispatchFs,
  ensureWalletForRosterDriverFs,
  subscribeDriverWallets,
} from "@/lib/fleet/driverWalletsFirestore";
import type { Reservation } from "@/lib/reservations/reservationStore";
import {
  getReservationByCode,
  subscribeActiveReservations,
} from "@/lib/reservations/reservationsFirestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useDocLock } from "@/lib/firestore/useDocLock";

type ExternalDispatchRow = {
  code: string;
  driverName: string;
  driverPhone: string;
  plate: string;
  tripDate: string; // dd/mm/yyyy
  tripTime: string; // HH:mm
  customerName: string;
  itinerary: string;
};

type ExternalDriverCardRow = {
  odCode: string;
  driverName: string;
  driverPhone: string;
  plate: string;
  trips: number;
  wallet?: DriverWallet;
  lastTrip?: {
    code: string;
    date: string;
    time: string;
    customerName: string;
    itinerary: string;
  };
};

export default function DriversPage() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [tab, setTab] = React.useState<DriverType>("internal");
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [wallets, setWallets] = React.useState<DriverWallet[]>([]);
  const [externalRows, setExternalRows] = React.useState<ExternalDispatchRow[]>([]);
  const [openExtBooking, setOpenExtBooking] = React.useState(false);
  const [extBookingCode, setExtBookingCode] = React.useState<string | null>(null);
  const [openAdd, setOpenAdd] = React.useState(false);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [editKey, setEditKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [form, setForm] = React.useState({
    employeeCode: "",
    name: "",
    phone: "",
    licenseType: "B2",
  });

  const lock = useDocLock({ resource: "drivers", resourceId: openEdit ? editKey : null, enabled: true });

  React.useEffect(() => {
    const unsubDrivers = subscribeDrivers(setDrivers);
    const unsubWallets = subscribeDriverWallets(setWallets);
    const unsub = subscribeActiveReservations(setReservations);
    return () => {
      unsub();
      unsubDrivers();
      unsubWallets();
    };
  }, []);

  React.useEffect(() => {
    // Ensure every roster driver has a wallet doc.
    for (const d of drivers) {
      void ensureWalletForRosterDriverFs(d.employeeCode, d.name);
    }
  }, [drivers]);

  function getWalletByEmployeeCodeLocal(employeeCode: string) {
    return wallets.find((w) => w.employeeCode === employeeCode);
  }

  function getWalletByDispatchPhonePlateLocal(phone: string, plate: string) {
    const p = String(phone || "").replace(/\D/g, "");
    const pl = String(plate || "").replace(/\s+/g, "").replace(/\./g, "").toUpperCase();
    return wallets.find((w) => w.source === "dispatch" && (w.phone || "").replace(/\D/g, "") === p && (w.plate || "").replace(/\s+/g, "").replace(/\./g, "").toUpperCase() === pl);
  }

  React.useEffect(() => {
    const rows = reservations
      .filter((r) => r.status === "Đã điều xe")
      .filter((r) => (r.assignedExternalPriceVnd ?? 0) > 0 || Boolean(r.assignedSupplierId))
      .map((r): ExternalDispatchRow => ({
        code: r.code,
        driverName: r.assignedDriver ?? "—",
        driverPhone: r.assignedDriverPhone ?? "—",
        plate: r.assignedVehiclePlate ?? "—",
        tripDate: r.date,
        tripTime: r.time,
        customerName: r.customerName,
        itinerary: r.itinerary,
      }));
    setExternalRows(rows);
    for (const x of rows) {
      if (x.driverName === "—") continue;
      if (x.driverPhone === "—") continue;
      if (x.plate === "—") continue;
      void ensureWalletForExternalDispatchFs(x.driverName, x.driverPhone, x.plate);
    }
  }, [reservations]);

  const internalCount = drivers.filter((d) => d.type === "internal").length;
  const externalCount = drivers.filter((d) => d.type === "external").length;

  const filtered = drivers
    .filter((d) => d.type === tab)
    .filter((d) => {
      const hay =
        `${d.name} ${d.employeeCode} ${d.phone} ${d.vehiclePlate ?? ""}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });

  const filteredExternal = externalRows.filter((r) => {
    const hay =
      `${r.driverName} ${r.driverPhone} ${r.plate} ${r.tripDate} ${r.customerName} ${r.code}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const externalDrivers: ExternalDriverCardRow[] = React.useMemo(() => {
    const byKey = new Map<string, Omit<ExternalDriverCardRow, "wallet">>();
    for (const r of filteredExternal) {
      if (r.driverName === "—" || r.driverPhone === "—" || r.plate === "—") continue;
      const key = `${normalizeDigits(r.driverPhone)}|${normalizePlate(r.plate)}`;
      const curr = byKey.get(key);
      if (curr) {
        const nextLast =
          !curr.lastTrip || tripKey(r.tripDate, r.tripTime) > tripKey(curr.lastTrip.date, curr.lastTrip.time)
            ? {
                code: r.code,
                date: r.tripDate,
                time: r.tripTime,
                customerName: r.customerName || "—",
                itinerary: r.itinerary || "—",
              }
            : curr.lastTrip;
        byKey.set(key, { ...curr, trips: curr.trips + 1, lastTrip: nextLast });
      } else {
        byKey.set(key, {
          odCode: odCodeFromExternal(r.driverPhone, r.plate),
          driverName: r.driverName,
          driverPhone: r.driverPhone,
          plate: r.plate,
          trips: 1,
          lastTrip: {
            code: r.code,
            date: r.tripDate,
            time: r.tripTime,
            customerName: r.customerName || "—",
            itinerary: r.itinerary || "—",
          },
        });
      }
    }
    const out: ExternalDriverCardRow[] = Array.from(byKey.values()).map((x) => ({
      ...x,
      wallet: getWalletByDispatchPhonePlateLocal(x.driverPhone, x.plate),
    }));
    out.sort((a, b) => a.driverName.localeCompare(b.driverName, "vi"));
    return out;
  }, [filteredExternal, wallets]);

  const stats = React.useMemo(() => {
    const byTab = drivers.filter((d) => d.type === tab);
    const total = byTab.length;
    const ready = byTab.filter((d) => d.status === "Sẵn sàng").length;
    const leave = byTab.filter((d) => d.status === "Nghỉ Phép").length;
    return { total, ready, leave };
  }, [drivers, tab]);

  return (
    <AppShell>
      <div className="flex-1 px-6 pb-10">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Quản lý Tài xế
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Danh sách và thông tin tài xế
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                aria-label="Về màn hình chính"
                onClick={() => router.push("/dashboard")}
              >
                <Home className="h-4 w-4" />
              </button>
              <Button
                className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                onClick={() => {
                  setError(null);
                  const nextCode = generateEmployeeCode(
                    drivers.map((d) => d.employeeCode),
                  );
                  setForm({
                    employeeCode: nextCode,
                    name: "",
                    phone: "",
                    licenseType: "B2",
                  });
                  setOpenAdd(true);
                }}
              >
                + Thêm tài xế
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="w-full md:max-w-sm">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm theo tên, SĐT, biển số..."
              />
            </div>
          </div>

          <div className="mt-3 inline-flex rounded-lg border border-zinc-200 bg-white p-1 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setTab("internal")}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                tab === "internal"
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
              }`}
            >
              <User className="h-4 w-4" />
              Lái xe nhà
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {internalCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab("external")}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                tab === "external"
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/40"
              }`}
            >
              <User className="h-4 w-4" />
              Lái xe ngoài
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {externalCount}
              </span>
            </button>
          </div>

          {tab === "internal" ? (
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <MiniStat value={stats.total} label="Tổng Số Lái Xe" />
              <MiniStat value={stats.ready} label="Sẵn sàng" />
              <MiniStat value={stats.leave} label="Nghỉ Phép" />
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {tab === "external" ? (
              <>
                {externalDrivers.map((x) => (
                  <ExternalDriverCard
                    key={x.odCode}
                    x={x}
                    onOpenBooking={(code) => {
                      setExtBookingCode(code);
                      setOpenExtBooking(true);
                    }}
                  />
                ))}
                {externalDrivers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-300">
                    Chưa có lái xe ngoài (từ điều xe).
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {filtered.map((d) => (
                  <DriverCard
                    key={d.employeeCode}
                    d={d}
                    wallet={getWalletByEmployeeCodeLocal(d.employeeCode)}
                    onChangeStatus={(status) => void upsertDriverFs({ ...d, status, updatedAt: Date.now() })}
                    onEdit={() => {
                      setError(null);
                      setEditKey(d.employeeCode);
                      setForm({
                        employeeCode: d.employeeCode,
                        name: d.name,
                        phone: d.phone,
                        licenseType: d.licenseType,
                      });
                      setOpenEdit(true);
                    }}
                    onDelete={() => void deleteDriverFs(d.employeeCode)}
                  />
                ))}
                {filtered.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-300">
                    Không có tài xế phù hợp.
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Thêm tài xế</DialogTitle>
              <DialogDescription>
                Nhập thông tin tài xế để lưu vào danh sách.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Mã nhân viên</label>
                <Input value={form.employeeCode} readOnly />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Tên Nhân Viên</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Số Điện Thoại</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0901234567"
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Loại Bằng Lái</label>
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                  value={form.licenseType}
                  onChange={(e) =>
                    setForm({ ...form, licenseType: e.target.value })
                  }
                >
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                  <option value="FC">FC</option>
                </select>
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button
                className="w-full"
                onClick={() => {
                  setError(null);
                  const name = form.name.trim();
                  const phone = form.phone.trim();
                  if (!name) return setError("Vui lòng nhập Tên Nhân Viên.");
                  if (!phone) return setError("Vui lòng nhập Số Điện Thoại.");

                  const now = Date.now();
                  const next: Driver = {
                    employeeCode: form.employeeCode,
                    name,
                    phone,
                    licenseType: form.licenseType,
                    type: tab,
                    status: "Sẵn sàng",
                    trips: 0,
                    vehiclePlate: undefined,
                    createdAt: now,
                    updatedAt: now,
                  };
                  try {
                    const dupCode = drivers.some((d) => d.employeeCode === next.employeeCode);
                    if (dupCode) throw new Error("duplicate_employee_code");
                    void upsertDriverFs(next);
                    void ensureWalletForRosterDriverFs(next.employeeCode, next.name);
                    setOpenAdd(false);
                  } catch (e) {
                    setError("Số điện thoại hoặc mã nhân viên đã tồn tại.");
                  }
                }}
              >
                Xác nhận
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={openEdit}
          onOpenChange={(v) => {
            setOpenEdit(v);
            if (!v) setEditKey(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit tài xế</DialogTitle>
              <DialogDescription>Cập nhật thông tin tài xế.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {editKey ? (
                !lock.isReady ? (
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                    Đang kiểm tra lock…
                  </div>
                ) : lock.canEdit ? (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                    Bạn đang sửa dữ liệu này.
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                    Dữ liệu đang được sửa bởi <b>{lock.lockedByName ?? "—"}</b>.
                  </div>
                )
              ) : null}
              <div className="space-y-1">
                <label className="text-sm font-medium">Mã nhân viên</label>
                <Input value={form.employeeCode} readOnly />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Tên Nhân Viên</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Số Điện Thoại</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Loại Bằng Lái</label>
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                  value={form.licenseType}
                  onChange={(e) =>
                    setForm({ ...form, licenseType: e.target.value })
                  }
                >
                  <option value="B1">B1</option>
                  <option value="B2">B2</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                  <option value="FC">FC</option>
                </select>
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button
                className="w-full"
                disabled={Boolean(editKey && lock.isReady && !lock.canEdit)}
                onClick={() => {
                  setError(null);
                  if (!editKey) return;
                  if (lock.isReady && !lock.canEdit) return setError(`Dữ liệu đang được sửa bởi ${lock.lockedByName ?? "—"}.`);
                  const name = form.name.trim();
                  const phone = form.phone.trim();
                  if (!name) return setError("Vui lòng nhập Tên Nhân Viên.");
                  if (!phone) return setError("Vui lòng nhập Số Điện Thoại.");

                  const current = drivers.find((d) => d.employeeCode === editKey);
                  if (!current) return setError("Không tìm thấy tài xế.");
                  void upsertDriverFs({
                    ...current,
                    name,
                    phone,
                    licenseType: form.licenseType,
                    updatedAt: Date.now(),
                  });
                  setOpenEdit(false);
                }}
              >
                Lưu
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={openExtBooking}
          onOpenChange={(v) => {
            setOpenExtBooking(v);
            if (!v) setExtBookingCode(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chi tiết Booking</DialogTitle>
              <DialogDescription>Thông tin chi tiết chuyến đi.</DialogDescription>
            </DialogHeader>

            {extBookingCode ? <ExternalBookingDetails code={extBookingCode} /> : null}
          </DialogContent>
        </Dialog>

      </div>
    </AppShell>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
    </div>
  );
}

function DriverCard({
  d,
  wallet,
  onChangeStatus,
  onEdit,
  onDelete,
}: {
  d: Driver;
  wallet?: DriverWallet;
  onChangeStatus: (s: "Sẵn sàng" | "Nghỉ Phép") => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [openStatus, setOpenStatus] = React.useState(false);
  const [openWallet, setOpenWallet] = React.useState(false);
  const badge =
    d.status === "Sẵn sàng"
      ? "bg-blue-100 text-blue-700"
      : d.status === "Đang chạy"
        ? "bg-amber-100 text-amber-800"
        : d.status === "Nghỉ Phép"
          ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          : "bg-orange-100 text-orange-800";

  return (
    <div className="relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {d.name}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {d.employeeCode} • {d.licenseType} • {d.trips} chuyến
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
              aria-label="Chia sẻ thông tin tài xế"
              onClick={() => shareDriver(d)}
              title="Chia sẻ"
            >
              <Share2 className="h-4 w-4" />
            </button>

            <div className="relative">
              <button
                type="button"
                className={`rounded-full px-2 py-1 text-xs font-medium ${badge}`}
                onClick={() => {
                  if (d.status !== "Sẵn sàng" && d.status !== "Nghỉ Phép") return;
                  setOpenStatus((v) => !v);
                }}
                title="Đổi trạng thái"
              >
                {d.status}
              </button>

              {openStatus ? (
                <div className="absolute right-0 top-8 z-10 w-36 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                    onClick={() => {
                      onChangeStatus("Sẵn sàng");
                      setOpenStatus(false);
                    }}
                  >
                    Sẵn Sàng
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                    onClick={() => {
                      onChangeStatus("Nghỉ Phép");
                      setOpenStatus(false);
                    }}
                  >
                    Nghỉ Phép
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
              aria-label="Edit tài xế"
              onClick={onEdit}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
              aria-label="Xoá tài xế"
              onClick={onDelete}
              title="Xoá"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-600 dark:text-zinc-300">
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
          <span className="whitespace-nowrap">{d.phone}</span>
        </div>
        {wallet ? (
          <div className="flex min-w-0 items-center gap-2 border-l border-zinc-200 pl-5 dark:border-zinc-700">
            <button
              type="button"
              className="rounded-md p-1 text-emerald-600 hover:bg-zinc-100 dark:text-emerald-500 dark:hover:bg-zinc-900"
              aria-label="Xem ví tài xế"
              title="Xem ví tài xế"
              onClick={() => setOpenWallet(true)}
            >
              <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
            <span className="truncate font-mono font-medium text-zinc-800 dark:text-zinc-100">
              {wallet.walletName}
            </span>
            <span className="tabular-nums text-zinc-700 dark:text-zinc-200">
              {formatBalances(wallet.balances)}
            </span>
          </div>
        ) : null}
      </div>

      <Dialog open={openWallet} onOpenChange={setOpenWallet}>
        <WalletDetailsDialog driverName={d.name} wallet={wallet} />
      </Dialog>
    </div>
  );
}

async function shareDriver(d: Driver) {
  const text =
    `Tài xế: ${d.name}\n` +
    `Mã NV: ${d.employeeCode}\n` +
    `SĐT: ${d.phone}\n` +
    `Bằng lái: ${d.licenseType}\n` +
    `Số chuyến: ${d.trips}\n` +
    `Trạng thái: ${d.status}\n`;

  if (navigator.share) {
    try {
      await navigator.share({ title: "Thông tin tài xế", text });
      return;
    } catch {
      // fallthrough
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    alert("Đã copy thông tin tài xế vào clipboard.");
  } catch {
    alert(text);
  }
}

function ExternalDriverCard({
  x,
  onOpenBooking,
}: {
  x: ExternalDriverCardRow;
  onOpenBooking: (code: string) => void;
}) {
  const [openWallet, setOpenWallet] = React.useState(false);
  return (
    <div
      className="relative cursor-default rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      onDoubleClick={() => {
        const code = x.lastTrip?.code;
        if (!code) return;
        onOpenBooking(code);
      }}
      title="Double click để xem chi tiết booking"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {x.driverName}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {x.odCode} • {x.plate} • {x.trips} chuyến
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300 md:items-end">
          <div className="font-medium text-zinc-900 dark:text-zinc-50">
            {x.lastTrip ? `${x.lastTrip.date} ${x.lastTrip.time}` : "—"}
          </div>
          <div className="line-clamp-1 max-w-[22rem] text-zinc-700 dark:text-zinc-200">
            {x.lastTrip?.customerName || "—"}
          </div>
          <div className="line-clamp-1 max-w-[22rem] text-zinc-500 dark:text-zinc-400">
            {x.lastTrip?.itinerary || "—"}
          </div>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-600 dark:text-zinc-300">
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
          <span className="whitespace-nowrap">{x.driverPhone}</span>
        </div>
        {x.wallet ? (
          <div className="flex min-w-0 items-center gap-2 border-l border-zinc-200 pl-5 dark:border-zinc-700">
            <button
              type="button"
              className="rounded-md p-1 text-emerald-600 hover:bg-zinc-100 dark:text-emerald-500 dark:hover:bg-zinc-900"
              aria-label="Xem ví tài xế"
              title="Xem ví tài xế"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpenWallet(true);
              }}
            >
              <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
            <span className="truncate font-mono font-medium text-zinc-800 dark:text-zinc-100">
              {x.wallet.walletName}
            </span>
            <span className="tabular-nums text-zinc-700 dark:text-zinc-200">
              {formatBalances(x.wallet.balances)}
            </span>
          </div>
        ) : null}
      </div>

      <Dialog open={openWallet} onOpenChange={setOpenWallet}>
        <WalletDetailsDialog driverName={x.driverName} wallet={x.wallet} />
      </Dialog>
    </div>
  );
}

function WalletDetailsDialog({ driverName, wallet }: { driverName: string; wallet?: DriverWallet }) {
  const payBtnClass =
    "h-10 rounded-xl px-5 font-semibold text-white shadow-sm " +
    "bg-gradient-to-b from-[#1AAAE1] to-[#0B79B8] " +
    "hover:from-[#22B4EC] hover:to-[#0A6EA7] " +
    "active:from-[#169BCF] active:to-[#096596] disabled:opacity-60";
  const earthBtnClass =
    "h-9 text-zinc-900 shadow-sm " +
    "bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] " +
    "hover:from-[#EBCB7A] hover:to-[#B98A1F] " +
    "active:from-[#DDBA5D] active:to-[#A87912]";

  const [openTransfer, setOpenTransfer] = React.useState(false);
  const [transferCurrency, setTransferCurrency] = React.useState<string>("VND");
  const [transferAmount, setTransferAmount] = React.useState<string>("");
  const [transferDest, setTransferDest] = React.useState<"CASH" | "VAT_VND" | "NOVAT_VND" | "USD">("CASH");
  const [transferError, setTransferError] = React.useState<string | null>(null);
  const [openHistory, setOpenHistory] = React.useState(false);

  const balances = wallet?.balances ?? { VND: 0 };
  const curKeys = React.useMemo(() => {
    const keys = Object.keys(balances ?? {})
      .map((k) => String(k || "").trim().toUpperCase())
      .filter(Boolean);
    const hasVnd = keys.includes("VND");
    const hasUsd = keys.includes("USD");
    const others = keys.filter((k) => k !== "VND" && k !== "USD");
    others.sort((a, b) => a.localeCompare(b));
    const out: string[] = [];
    out.push("VND");
    if (hasUsd || (Number(balances["USD"] ?? 0) || 0) !== 0) out.push("USD");
    for (const k of others) {
      const amt = Number((balances as any)[k] ?? 0) || 0;
      if (amt !== 0) out.push(k);
    }
    // include VND even if not present
    if (!hasVnd) {
      // no-op, VND already pushed
    }
    return out;
  }, [balances]);

  const fmt = (amt: number, cur: string) => {
    const c = String(cur || "VND").trim().toUpperCase() || "VND";
    const n = Number(amt ?? 0) || 0;
    if (c === "VND") return `${Math.round(n).toLocaleString("vi-VN")} VND`;
    return `${Math.round(n).toLocaleString("en-US")} ${c}`;
  };

  const paymentInfo = React.useMemo(() => (typeof window === "undefined" ? null : getPaymentInfo()), []);
  const [cashbookEntries, setCashbookEntries] = React.useState<CashbookEntry[]>([]);
  React.useEffect(() => {
    const unsub = subscribeCashbookEntries(setCashbookEntries);
    return () => unsub();
  }, []);
  const walletHistory = React.useMemo(() => {
    const key = wallet?.key ? `WALLET:${wallet.key}` : "";
    if (!key) return [] as CashbookEntry[];
    return cashbookEntries
      .filter((e) => e.sourceId === key)
      .slice()
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [wallet?.key, cashbookEntries]);

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <DialogTitle>Ví tài xế</DialogTitle>
            <DialogDescription>{driverName}</DialogDescription>
          </div>
          <Button className={earthBtnClass} onClick={() => setOpenHistory(true)} disabled={!wallet?.key}>
            Lịch sử giao dịch
          </Button>
        </div>
      </DialogHeader>

      <div className="space-y-3 text-sm">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Tên ví</div>
          <div className="mt-1 font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {wallet?.walletName ?? "—"}
          </div>
        </div>

        {curKeys.map((cur) => {
          const amt = Number((balances as any)[cur] ?? 0) || 0;
          const negative = amt < 0;
          return (
            <div
              key={cur}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="min-w-0">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">Số dư {cur}</div>
                <div
                  className={[
                    "mt-1 text-lg font-semibold tabular-nums",
                    negative ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-50",
                  ].join(" ")}
                >
                  {fmt(amt, cur)}
                </div>
              </div>
              <Button
                className={payBtnClass + " h-9 px-4"}
                onClick={() => {
                  setTransferError(null);
                  setTransferCurrency(cur);
                  setTransferAmount(String(Math.max(Math.round(amt), 0) || ""));
                  setTransferDest(cur === "USD" ? "USD" : "CASH");
                  setOpenTransfer(true);
                }}
                disabled={!wallet?.key}
              >
                Chuyển Tiền
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chuyển tiền từ ví</DialogTitle>
            <DialogDescription>
              {wallet?.walletName ?? "—"} • {transferCurrency}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Chuyển tới</div>
              <select
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                value={transferDest}
                onChange={(e) => setTransferDest(e.target.value as any)}
              >
                <option value="CASH">TM (Tiền mặt)</option>
                <option value="VAT_VND">
                  TK VAT - VND {paymentInfo?.vatVnd.bankName ? `• ${paymentInfo.vatVnd.bankName}` : ""}
                </option>
                <option value="NOVAT_VND">
                  TK No VAT - VND {paymentInfo?.noVatVnd.bankName ? `• ${paymentInfo.noVatVnd.bankName}` : ""}
                </option>
                <option value="USD">TK USD {paymentInfo?.usd.bankName ? `• ${paymentInfo.usd.bankName}` : ""}</option>
              </select>
              <div className="mt-1 text-xs text-zinc-500">
                Ghi nhận 2 dòng sổ thu chi: OUT từ ví, IN vào nguồn nhận.
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">Số tiền</div>
              <Input
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </div>

            {transferError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {transferError}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" className="h-9" onClick={() => setOpenTransfer(false)}>
                Huỷ
              </Button>
              <Button
                className={payBtnClass + " h-9 px-4"}
                onClick={() => {
                  setTransferError(null);
                  if (!wallet?.key) return setTransferError("Không tìm thấy ví.");
                  const amt = Math.round(Number(String(transferAmount).replace(/[^\d.]/g, "")) || 0);
                  if (!amt || amt <= 0) return setTransferError("Số tiền không hợp lệ.");
                  const cur = String(transferCurrency || "VND").trim().toUpperCase() || "VND";
                  const current = Number((balances as any)[cur] ?? 0) || 0;
                  if (amt > current) return setTransferError("Số tiền vượt quá số dư ví.");
                  if (cur === "USD" && transferDest !== "USD" && transferDest !== "CASH") {
                    return setTransferError("USD chỉ chuyển về TM hoặc TK USD.");
                  }
                  if (cur === "VND" && transferDest === "USD") {
                    return setTransferError("VND không chuyển về TK USD.");
                  }

                  // OUT from wallet
                  void addCashbookEntryFs({
                    direction: "OUT",
                    sourceId: `WALLET:${wallet.key}`,
                    currency: cur,
                    amount: amt,
                    method: "CK",
                    content: `Chuyển tiền • OUT • ${wallet.walletName}`,
                    referenceType: "WALLET_TRANSFER",
                    referenceId: `${wallet.key}:${Date.now()}`,
                  });
                  // IN to destination
                  void addCashbookEntryFs({
                    direction: "IN",
                    sourceId: transferDest,
                    currency: cur,
                    amount: amt,
                    method: transferDest === "CASH" ? "TM" : "CK",
                    content: `Chuyển tiền • IN • ${wallet.walletName}`,
                    referenceType: "WALLET_TRANSFER",
                    referenceId: `${wallet.key}:${Date.now()}`,
                  });
                  // adjust wallet balance
                  // NOTE: balances in wallet store is the source-of-truth for wallet UI
                  // and cashbook is used for overall cash flow.
                  // This keeps both consistent with other payment flows.
                  void adjustDriverWalletBalanceFs(wallet.key, cur, -amt);

                  setOpenTransfer(false);
                }}
              >
                Xác nhận
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openHistory} onOpenChange={setOpenHistory}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Lịch sử giao dịch</DialogTitle>
            <DialogDescription>
              {wallet?.walletName ?? "—"} • {driverName}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2">Ngày</th>
                  <th className="px-3 py-2">Giờ</th>
                  <th className="px-3 py-2">Thu/Chi</th>
                  <th className="px-3 py-2 text-right">Số tiền</th>
                  <th className="px-3 py-2">Nội dung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {walletHistory.map((e) => {
                  const dir = e.direction === "IN" ? "Thu" : "Chi";
                  const isIn = e.direction === "IN";
                  const cur = String(e.currency || "VND").trim().toUpperCase() || "VND";
                  const amt =
                    cur === "VND"
                      ? `${Math.round(e.amount).toLocaleString("vi-VN")} VND`
                      : `${Math.round(e.amount).toLocaleString("en-US")} ${cur}`;
                  return (
                    <tr key={e.id} className="bg-white dark:bg-zinc-950">
                      <td className="px-3 py-2 whitespace-nowrap">{e.createdDate}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{e.createdTime}</td>
                      <td className="px-3 py-2">
                        <span
                          className={[
                            "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                            isIn ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700",
                          ].join(" ")}
                        >
                          {dir}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{amt}</td>
                      <td className="px-3 py-2">{e.content}</td>
                    </tr>
                  );
                })}

                {walletHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-zinc-500">
                      Chưa có giao dịch.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </DialogContent>
  );
}

function formatBalances(balances: Record<string, number> | undefined) {
  const b = balances ?? {};
  const rows: Array<{ cur: string; amt: number }> = [];
  rows.push({ cur: "VND", amt: Number(b["VND"] ?? 0) || 0 });
  for (const [curRaw, amtRaw] of Object.entries(b)) {
    const cur = String(curRaw || "").trim().toUpperCase();
    if (!cur || cur === "VND") continue;
    const amt = Number(amtRaw ?? 0) || 0;
    rows.push({ cur, amt });
  }
  return rows
    .map((x) =>
      x.cur === "VND"
        ? `${x.amt.toLocaleString("vi-VN")} VND`
        : `${x.amt.toLocaleString("en-US")} ${x.cur}`,
    )
    .join(" • ");
}

function normalizeDigits(s: string) {
  return s.replace(/\D/g, "");
}

function normalizePlate(s: string) {
  return s.replace(/\s+/g, "").replace(/\./g, "").toUpperCase();
}

function tripKey(dateDmy: string, timeHm: string) {
  const [dd, mm, yyyy] = (dateDmy ?? "").split("/").map((x) => Number(x));
  const [hh, mi] = (timeHm ?? "").split(":").map((x) => Number(x));
  const y = Number.isFinite(yyyy) ? yyyy : 0;
  const m = Number.isFinite(mm) ? mm : 0;
  const d = Number.isFinite(dd) ? dd : 0;
  const h = Number.isFinite(hh) ? hh : 0;
  const n = Number.isFinite(mi) ? mi : 0;
  return (((y * 100 + m) * 100 + d) * 100 + h) * 100 + n;
}

function ExternalBookingDetails({ code }: { code: string }) {
  const [row, setRow] = React.useState<Reservation | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found = await getReservationByCode(code);
      if (cancelled) return;
      setRow(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (!row) {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        Không tìm thấy booking.
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <Detail label="Mã booking" value={row.code} />
        <Detail label="Trạng thái" value={row.status} />
        <Detail label="Ngày" value={row.date} />
        <Detail label="Giờ" value={row.time} />
      </div>
      <Detail label="Khách hàng" value={row.customerName} />
      <Detail label="Hành trình" value={row.itinerary} />
      <Detail label="Điểm đón" value={row.pickup} />
      <Detail label="Điểm trả" value={row.dropoff} />
      <Detail label="Giá trị" value={`${row.amount.toLocaleString("vi-VN")} ${row.currency}`} />
      <div className="pt-2">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Tài xế</div>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <Detail label="Tên tài xế" value={row.assignedDriver ?? "—"} />
          <Detail label="SĐT tài xế" value={row.assignedDriverPhone ?? "—"} />
          <Detail label="Biển số xe" value={row.assignedVehiclePlate ?? "—"} />
          <Detail label="Loại xe" value={row.vehicleType ?? "—"} />
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="font-medium text-zinc-900 dark:text-zinc-50">{value}</div>
    </div>
  );
}

