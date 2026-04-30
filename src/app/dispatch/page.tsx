"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type Reservation,
} from "@/lib/reservations/reservationStore";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Driver } from "@/lib/fleet/driverStore";
import type { Vehicle } from "@/lib/fleet/vehicleStore";
import { subscribeDrivers } from "@/lib/fleet/driversFirestore";
import { subscribeVehicles } from "@/lib/fleet/vehiclesFirestore";
import { Input } from "@/components/ui/input";
import type { Supplier } from "@/lib/data/partnersStore";
import { subscribeSuppliers } from "@/lib/data/partnersFirestore";
import {
  ensureWalletForExternalDispatchFs,
  ensureWalletForRosterDriverFs,
} from "@/lib/fleet/driverWalletsFirestore";
import { useSearchParams } from "next/navigation";
import { patchReservation, subscribeActiveReservations } from "@/lib/reservations/reservationsFirestore";

export default function DispatchPage() {
  return (
    <React.Suspense fallback={<DispatchSkeleton />}>
      <DispatchInner />
    </React.Suspense>
  );
}

function DispatchSkeleton() {
  return (
    <AppShell>
      <div className="px-6 pb-10">
        <div className="pt-6">
          <div className="h-7 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-4 w-72 rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </div>
    </AppShell>
  );
}

function DispatchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = React.useState<Reservation[]>([]);
  const [open, setOpen] = React.useState(false);
  const [order, setOrder] = React.useState<Reservation | null>(null);
  const [tab, setTab] = React.useState<"internal" | "external">("internal");
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [selectedDriverCode, setSelectedDriverCode] = React.useState<string | null>(null);
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [selectedPlate, setSelectedPlate] = React.useState<string>("");
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [extForm, setExtForm] = React.useState({
    name: "",
    phone: "",
    plate: "",
    priceVnd: "",
    supplierId: "",
    supplierPaymentType: "" as "" | "Phải Trả" | "Công Nợ",
  });

  React.useEffect(() => {
    const unsub = subscribeActiveReservations(setOrders);
    const unsubD = subscribeDrivers(setDrivers);
    const unsubV = subscribeVehicles(setVehicles);
    const unsubS = subscribeSuppliers(setSuppliers);
    return () => {
      unsub();
      unsubD();
      unsubV();
      unsubS();
    };
  }, []);

  React.useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;
    const o = orders.find((x) => x.code === code);
    if (!o) return;
    setOrder(o);
    setSelectedDriverCode(null);
    setSelectedPlate(o.assignedVehiclePlate ?? "");
    const isExternal =
      Boolean(o.assignedExternalPriceVnd) ||
      Boolean(o.assignedSupplierId) ||
      Boolean(o.assignedSupplierPaymentType);
    setTab(isExternal ? "external" : "internal");
    if (isExternal) {
      setExtForm({
        name: o.assignedDriver ?? "",
        phone: o.assignedDriverPhone ?? "",
        plate: o.assignedVehiclePlate ?? "",
        priceVnd: o.assignedExternalPriceVnd
          ? String(o.assignedExternalPriceVnd)
          : "",
        supplierId: o.assignedSupplierId ?? "",
        supplierPaymentType: (o.assignedSupplierPaymentType ?? "") as
          | ""
          | "Phải Trả"
          | "Công Nợ",
      });
    } else {
      setExtForm({
        name: "",
        phone: "",
        plate: "",
        priceVnd: "",
        supplierId: "",
        supplierPaymentType: "",
      });
    }
    setOpen(true);
  }, [searchParams, orders]);

  const waiting = orders.filter((o) => o.status === "Chờ điều xe").length;
  const dispatched = orders.filter((o) => o.status === "Đã điều xe").length;

  return (
    <AppShell>
      <div className="px-6 pb-10">
        <div className="pt-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Trung tâm Điều xe
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Quản lý và điều phối xe cho các chuyến đi
          </p>

          <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                <Truck className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                Trung tâm Điều xe
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                  onClick={() => router.push("/reservation/new")}
                >
                  Reservation
                </Button>
                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                  {waiting} chờ điều xe
                </span>
                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                  {dispatched} đã điều xe
                </span>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  <tr>
                    <th className="px-3 py-2">Mã</th>
                    <th className="px-3 py-2">Khách hàng</th>
                    <th className="px-3 py-2">Điểm đón</th>
                    <th className="px-3 py-2">Điểm trả</th>
                    <th className="px-3 py-2">Ngày giờ</th>
                    <th className="px-3 py-2">Loại xe</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                  {orders.map((o) => (
                    <tr key={o.code} className="bg-white dark:bg-zinc-950">
                      <td className="px-3 py-2 font-mono text-xs">{o.code}</td>
                      <td className="px-3 py-2">{o.customerName}</td>
                      <td className="px-3 py-2">{o.pickup}</td>
                      <td className="px-3 py-2">{o.dropoff}</td>
                      <td className="px-3 py-2">
                        <div className="text-sm">{o.date}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {o.time}
                        </div>
                      </td>
                      <td className="px-3 py-2">{o.vehicleType}</td>
                      <td className="px-3 py-2">
                        {o.status === "Chờ điều xe" ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                            Chờ điều xe
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                              Đã điều xe
                            </span>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              {o.assignedDriver ?? "—"}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          className="h-9 px-3 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                          onClick={() => {
                            setOrder(o);
                            setSelectedDriverCode(null);
                            setSelectedPlate("");
                            setTab("internal");
                            setExtForm({
                              name: "",
                              phone: "",
                              plate: "",
                              priceVnd: "",
                              supplierId: "",
                              supplierPaymentType: "",
                            });
                            setOpen(true);
                          }}
                        >
                          Điều xe
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {orders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-8 text-center text-zinc-500"
                      >
                        Chưa có chuyến nào.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setOrder(null);
            setSelectedDriverCode(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
              Điều xe cho chuyến {order?.code ?? ""}
            </DialogTitle>
            <DialogDescription>Chọn tài xế để điều xe.</DialogDescription>
          </DialogHeader>

          {order ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {order.customerName}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {order.pickup} → {order.dropoff}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {order.date} – {order.time}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {order.vehicleType}
                    </span>
                    <div className="text-sm font-semibold text-[#2E7AB0]">
                      {(order.amount ?? 0).toLocaleString("vi-VN")}₫
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setTab("internal")}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    tab === "internal"
                      ? "bg-[#2E7AB0] text-white"
                      : "bg-transparent text-zinc-700 dark:text-zinc-200"
                  }`}
                >
                  Lái xe công ty
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab("external");
                    setSelectedDriverCode(null);
                    setSelectedPlate("");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                    tab === "external"
                      ? "bg-[#2E7AB0] text-white"
                      : "bg-transparent text-zinc-700 dark:text-zinc-200"
                  }`}
                >
                  Điều xe ngoài
                </button>
              </div>

              {tab === "internal" ? (
                <div className="max-h-[340px] space-y-3 overflow-auto pr-1">
                  {drivers
                    .filter((d) => d.type === "internal")
                    .map((d) => (
                      <DriverCard
                        key={d.employeeCode}
                        d={d}
                        selected={selectedDriverCode === d.employeeCode}
                        showVehicleSelect={
                          selectedDriverCode === d.employeeCode
                        }
                        selectedPlate={selectedPlate}
                        vehicles={vehicles.filter((v) => v.status === "Sẵn sàng")}
                        onPlateChange={(plate) => setSelectedPlate(plate)}
                        onSelect={() => {
                          setSelectedDriverCode(d.employeeCode);
                          setSelectedPlate("");
                        }}
                      />
                    ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <Field label="Tên lái xe">
                    <Input
                      value={extForm.name}
                      onChange={(e) =>
                        setExtForm({ ...extForm, name: e.target.value })
                      }
                      placeholder="Nhập tên lái xe"
                    />
                  </Field>
                  <Field label="Số điện thoại">
                    <Input
                      value={extForm.phone}
                      onChange={(e) =>
                        setExtForm({ ...extForm, phone: e.target.value })
                      }
                      placeholder="Nhập số điện thoại"
                      inputMode="tel"
                    />
                  </Field>
                  <Field label="Biển số xe">
                    <Input
                      value={extForm.plate}
                      onChange={(e) =>
                        setExtForm({ ...extForm, plate: e.target.value })
                      }
                      placeholder="VD: 51A-12345"
                    />
                  </Field>
                  <Field label="Giá thuê ngoài (VND)">
                    <Input
                      value={extForm.priceVnd}
                      onChange={(e) =>
                        setExtForm({ ...extForm, priceVnd: e.target.value })
                      }
                      placeholder="Nhập giá thuê xe ngoài"
                      inputMode="numeric"
                    />
                  </Field>

                  <Field label="Supplier">
                    <select
                      className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                      value={extForm.supplierId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const s = suppliers.find((x) => x.id === id);
                        setExtForm({
                          ...extForm,
                          supplierId: id,
                          supplierPaymentType:
                            (s?.paymentType ?? "") as "" | "Phải Trả" | "Công Nợ",
                        });
                      }}
                    >
                      <option value="">—</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Hình thức thanh toán">
                    <Input value={extForm.supplierPaymentType || "—"} readOnly />
                  </Field>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  className="h-10 w-1/2 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                  onClick={() => setOpen(false)}
                >
                  Huỷ
                </Button>
                <Button
                  className="h-10 w-1/2 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912] disabled:opacity-60"
                  disabled={
                    tab === "internal"
                      ? !selectedDriverCode || !selectedPlate
                      : !extForm.name.trim() ||
                        !extForm.phone.trim() ||
                        !extForm.plate.trim()
                  }
                  onClick={() => {
                    if (!order) return;
                    if (tab === "internal") {
                      if (!selectedDriverCode || !selectedPlate) return;
                      const d = drivers.find(
                        (x) => x.employeeCode === selectedDriverCode,
                      );
                      if (!d) return;
                      void patchReservation(order.code, {
                        status: "Đã điều xe",
                        assignedDriver: d.name,
                        assignedDriverPhone: d.phone,
                        assignedVehiclePlate: selectedPlate,
                        assignedExternalPriceVnd: null,
                        assignedSupplierId: null,
                        assignedSupplierPaymentType: null,
                      } as any);
                      void ensureWalletForRosterDriverFs(d.employeeCode, d.name);
                    } else {
                      const price = Number(extForm.priceVnd.replace(/[^\d]/g, ""));
                      const nm = extForm.name.trim();
                      const ph = extForm.phone.trim();
                      const pl = extForm.plate.trim();
                      void patchReservation(order.code, {
                        status: "Đã điều xe",
                        assignedDriver: nm,
                        assignedDriverPhone: ph,
                        assignedVehiclePlate: pl,
                        assignedExternalPriceVnd: Number.isFinite(price) ? price : null,
                        assignedSupplierId: extForm.supplierId || null,
                        assignedSupplierPaymentType: extForm.supplierPaymentType || null,
                      } as any);
                      void ensureWalletForExternalDispatchFs(nm, ph, pl);
                    }
                    setOpen(false);
                  }}
                >
                  ✓ Xác nhận điều xe
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function DriverCard({
  d,
  selected,
  showVehicleSelect,
  vehicles,
  selectedPlate,
  onPlateChange,
  onSelect,
}: {
  d: Driver;
  selected: boolean;
  showVehicleSelect: boolean;
  vehicles: Vehicle[];
  selectedPlate: string;
  onPlateChange: (plate: string) => void;
  onSelect: () => void;
}) {
  const badge =
    d.status === "Sẵn sàng"
      ? "bg-blue-100 text-blue-700"
      : d.status === "Đang chạy"
        ? "bg-amber-100 text-amber-800"
        : "bg-zinc-100 text-zinc-700";

  return (
    <div
      className={`rounded-xl border p-4 ${
        selected
          ? "border-[#2E7AB0] bg-[#2E7AB0]/5"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {d.name?.trim()?.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
              {d.name}
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {d.phone} • {d.vehiclePlate || "—"}
            </div>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${badge}`}>
          {d.status}
        </span>
      </div>

      <div className="mt-3">
        <Button
          variant={selected ? "primary" : "secondary"}
          className={`h-9 w-full ${selected ? "bg-[#2E7AB0] text-white hover:bg-[#276a98]" : ""}`}
          onClick={onSelect}
        >
          {selected ? "Đã chọn" : "Chọn tài xế này"}
        </Button>
      </div>

      {showVehicleSelect ? (
        <div className="mt-4 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            <span className="text-lg">🚗</span>
            Chọn xe cho chuyến này
          </div>
          <div className="mt-3">
            <select
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
              value={selectedPlate}
              onChange={(e) => onPlateChange(e.target.value)}
            >
              <option value="">Chọn biển số xe...</option>
              {vehicles.map((v) => (
                <option key={v.plate} value={v.plate}>
                  {v.plate} • {v.name} • {v.type}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}

