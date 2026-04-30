"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Car,
  CircleCheck,
  CircleX,
  Home,
  Pencil,
  Trash2,
  Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type Vehicle,
} from "@/lib/fleet/vehicleStore";
import {
  deleteVehicleFs,
  subscribeVehicles,
  upsertVehicleFs,
} from "@/lib/fleet/vehiclesFirestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDocLock } from "@/lib/firestore/useDocLock";

export default function VehiclesPage() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [openAdd, setOpenAdd] = React.useState(false);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [editKey, setEditKey] = React.useState<string | null>(null);
  const [addError, setAddError] = React.useState<string | null>(null);
  const lock = useDocLock({ resource: "vehicles", resourceId: openEdit ? editKey : null, enabled: true });
  const [form, setForm] = React.useState({
    plate: "",
    name: "",
    year: String(new Date().getFullYear()),
    type: "4 chỗ",
    km: "",
  });

  React.useEffect(() => {
    const unsub = subscribeVehicles(setVehicles);
    return () => unsub();
  }, []);

  const filtered = vehicles.filter((v) => {
    const hay = `${v.plate} ${v.name} ${v.year} ${v.type}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const stats = React.useMemo(() => {
    const total = vehicles.length;
    const ready = vehicles.filter((v) => computeVehicleStatus(v) === "Sẵn sàng").length;
    const needOil = vehicles.filter((v) => computeVehicleStatus(v) === "Cần thay dầu").length;
    const needService = vehicles.filter((v) => computeVehicleStatus(v) === "Cần bảo trì").length;
    const stopped = 0;
    return { total, ready, needOil, needService, stopped };
  }, [vehicles]);

  return (
    <AppShell>
      <div className="flex-1 px-6 pb-10">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Quản lý Xe
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Danh sách đội xe công ty
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
                    setAddError(null);
                    setForm({
                      plate: "",
                      name: "",
                      year: String(new Date().getFullYear()),
                      type: "4 chỗ",
                      km: "",
                    });
                    setOpenAdd(true);
                  }}
                >
                  + Thêm xe mới
                </Button>
              </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <StatCard icon={<Car className="h-4 w-4" />} label="Tổng số xe" value={stats.total} />
            <StatCard
              icon={<CircleCheck className="h-4 w-4" />}
              label="Sẵn sàng"
              value={stats.ready}
              tone="blue"
            />
            <StatCard
              icon={<Wrench className="h-4 w-4" />}
              label="Cần thay dầu"
              value={stats.needOil}
              tone="amber"
            />
            <StatCard
              icon={<CircleX className="h-4 w-4" />}
              label="Cần bảo trì"
              value={stats.needService}
              tone="red"
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm theo biển số, tên xe..."
              />
            </div>
            <select className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950">
              <option>Tất cả loại</option>
              <option>4 chỗ</option>
              <option>7 chỗ</option>
              <option>16 chỗ</option>
            </select>
            <select className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950">
              <option>Tất cả</option>
              <option>Sẵn sàng</option>
              <option>Đang có chuyến</option>
              <option>Đang bảo trì</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filtered.map((v) => (
            <VehicleCard
              key={v.plate}
              v={v}
              onEdit={() => {
                setAddError(null);
                setEditKey(v.plate);
                setForm({
                  plate: v.plate,
                  name: v.name,
                  year: String(v.year),
                  type: v.type,
                  km: String(v.km),
                });
                setOpenEdit(true);
              }}
              onOilChanged={() => {
                const next: Vehicle = {
                  ...v,
                  lastOilChangeKm: v.km,
                  updatedAt: Date.now(),
                };
                void upsertVehicleFs(next);
              }}
              onServiced={() => {
                const next: Vehicle = {
                  ...v,
                  lastServiceKm: v.km,
                  updatedAt: Date.now(),
                };
                void upsertVehicleFs(next);
              }}
              onDelete={() => {
                void deleteVehicleFs(v.plate);
              }}
            />
          ))}

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-black dark:text-zinc-300">
              Không có dữ liệu phù hợp.
            </div>
          ) : null}
        </div>

        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Thêm Xe</DialogTitle>
              <DialogDescription>
                Nhập thông tin xe để lưu vào danh sách.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Biển số xe</label>
                <Input
                  value={form.plate}
                  onChange={(e) => setForm({ ...form, plate: e.target.value })}
                  placeholder="51A-123.45"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Tên xe</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Toyota Vios"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Đời xe</label>
                  <Input
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Loại xe</label>
                  <select
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option>4 chỗ</option>
                    <option>7 chỗ</option>
                    <option>16 chỗ</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Số km</label>
                <Input
                  value={form.km}
                  onChange={(e) => setForm({ ...form, km: e.target.value })}
                  inputMode="numeric"
                  placeholder="45000"
                />
              </div>

              {addError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {addError}
                </div>
              ) : null}

              <Button
                className="w-full text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                onClick={() => {
                  setAddError(null);
                  const plate = form.plate.trim();
                  const name = form.name.trim();
                  const year = Number(form.year);
                  const km = Number(form.km);
                  if (!plate) return setAddError("Vui lòng nhập Biển số xe.");
                  if (!name) return setAddError("Vui lòng nhập Tên xe.");
                  if (!Number.isFinite(year) || year < 1990 || year > 2100) {
                    return setAddError("Đời xe không hợp lệ.");
                  }
                  if (!Number.isFinite(km) || km < 0) {
                    return setAddError("Số km không hợp lệ.");
                  }

                  const now = Date.now();
                  const v: Vehicle = {
                    plate,
                    name,
                    year,
                    type: form.type,
                    km,
                    // tạm thời set = km hiện tại, sau này module bảo trì sẽ cập nhật tự động
                    lastServiceKm: km,
                    // tạm thời set = km hiện tại, sau này module thay dầu sẽ cập nhật tự động
                    lastOilChangeKm: km,
                    status: "Sẵn sàng",
                    createdAt: now,
                    updatedAt: now,
                  };

                  try {
                    const exists = vehicles.some(
                      (x) => x.plate.trim().toLowerCase() === plate.toLowerCase(),
                    );
                    if (exists) throw new Error("duplicate_plate");
                    void upsertVehicleFs(v);
                    setOpenAdd(false);
                  } catch (e) {
                    setAddError("Biển số xe đã tồn tại.");
                  }
                }}
              >
                Lưu
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={openEdit}
          onOpenChange={(v) => {
            setOpenEdit(v);
            if (!v) {
              setEditKey(null);
              setAddError(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Xe</DialogTitle>
              <DialogDescription>Cập nhật thông tin xe.</DialogDescription>
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
                <label className="text-sm font-medium">Biển số xe</label>
                <Input
                  value={form.plate}
                  onChange={(e) => setForm({ ...form, plate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Tên xe</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Đời xe</label>
                  <Input
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Loại xe</label>
                  <select
                    className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option>4 chỗ</option>
                    <option>7 chỗ</option>
                    <option>16 chỗ</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Số km</label>
                <Input
                  value={form.km}
                  onChange={(e) => setForm({ ...form, km: e.target.value })}
                  inputMode="numeric"
                />
              </div>

              {addError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {addError}
                </div>
              ) : null}

              <Button
                className="w-full text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                disabled={Boolean(editKey && lock.isReady && !lock.canEdit)}
                onClick={() => {
                  setAddError(null);
                  if (!editKey) return;
                  if (lock.isReady && !lock.canEdit) return setAddError(`Dữ liệu đang được sửa bởi ${lock.lockedByName ?? "—"}.`);
                  const plate = form.plate.trim();
                  const name = form.name.trim();
                  const year = Number(form.year);
                  const km = Number(form.km);
                  if (!plate) return setAddError("Vui lòng nhập Biển số xe.");
                  if (!name) return setAddError("Vui lòng nhập Tên xe.");
                  if (!Number.isFinite(year) || year < 1990 || year > 2100) {
                    return setAddError("Đời xe không hợp lệ.");
                  }
                  if (!Number.isFinite(km) || km < 0) {
                    return setAddError("Số km không hợp lệ.");
                  }

                  const current = vehicles.find(
                    (x) => x.plate.toLowerCase() === editKey.toLowerCase(),
                  );
                  if (!current) return setAddError("Không tìm thấy xe.");

                  const next: Vehicle = {
                    ...current,
                    plate,
                    name,
                    year,
                    type: form.type,
                    km,
                    lastOilChangeKm:
                      typeof current.lastOilChangeKm === "number"
                        ? current.lastOilChangeKm
                        : km,
                    updatedAt: Date.now(),
                  };

                  try {
                    const plateChanged =
                      current.plate.trim().toLowerCase() !== plate.toLowerCase();
                    const duplicate =
                      plateChanged &&
                      vehicles.some(
                        (x) => x.plate.trim().toLowerCase() === plate.toLowerCase(),
                      );
                    if (duplicate) throw new Error("duplicate_plate");
                    void upsertVehicleFs(next);
                    setOpenEdit(false);
                  } catch (e) {
                    setAddError("Biển số xe đã tồn tại.");
                  }
                }}
              >
                Lưu
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function fmtKm(n: number) {
  return `${n.toLocaleString("vi-VN")} km`;
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "blue" | "amber" | "red";
}) {
  const color =
    tone === "blue"
      ? "text-blue-600"
      : tone === "amber"
        ? "text-amber-600"
        : tone === "red"
          ? "text-red-600"
          : "text-zinc-600";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className={color}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "Sẵn sàng" | "Cần thay dầu" | "Cần bảo trì";
}) {
  const cls =
    status === "Sẵn sàng"
      ? "bg-blue-100 text-blue-700"
      : status === "Cần thay dầu"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function VehicleCard({
  v,
  onEdit,
  onOilChanged,
  onServiced,
  onDelete,
}: {
  v: Vehicle;
  onEdit: () => void;
  onOilChanged: () => void;
  onServiced: () => void;
  onDelete: () => void;
}) {
  const status = computeVehicleStatus(v);
  const showOil = status === "Cần thay dầu";
  const showService = status === "Cần bảo trì";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {v.plate}
            </div>
            <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {v.type}
            </span>
          </div>
          <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
            {v.name} • {v.year}
          </div>
        </div>

        <div className="flex items-center gap-2 md:justify-end">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={onEdit}
            aria-label="Edit"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={onDelete}
            aria-label="Xoá"
            title="Xoá"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 text-xs text-zinc-600 dark:text-zinc-300 md:grid-cols-3">
        <InfoItem label="Km đã chạy" value={fmtKm(v.km)} />
        <InfoItem
          label="Km Thay Dầu Gần Nhất"
          value={fmtKm(v.lastOilChangeKm)}
          action={
            showOil ? (
              <button
                type="button"
                className="ml-2 inline-flex h-7 items-center rounded-md bg-amber-100 px-2 text-xs font-medium text-amber-800 hover:bg-amber-200"
                onClick={onOilChanged}
              >
                Đã thay dầu
              </button>
            ) : null
          }
        />
        <InfoItem
          label="Km Bảo Trì Gần Nhất"
          value={fmtKm(v.lastServiceKm)}
          action={
            showService ? (
              <button
                type="button"
                className="ml-2 inline-flex h-7 items-center rounded-md bg-red-100 px-2 text-xs font-medium text-red-800 hover:bg-red-200"
                onClick={onServiced}
              >
                Đã bảo trì
              </button>
            ) : null
          }
        />
      </div>

      <div className="mt-3 flex justify-end">
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 flex items-center text-sm font-medium text-zinc-900 dark:text-zinc-50">
        <span>{value}</span>
        {action}
      </div>
    </div>
  );
}

function computeVehicleStatus(v: Vehicle): "Sẵn sàng" | "Cần thay dầu" | "Cần bảo trì" {
  const needOil = v.km - v.lastOilChangeKm > 5000;
  if (needOil) return "Cần thay dầu";
  const needService = v.km - v.lastServiceKm > 10000;
  if (needService) return "Cần bảo trì";
  return "Sẵn sàng";
}

