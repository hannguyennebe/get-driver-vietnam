"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import {
  deleteItinerary,
  ensureItineraryStore,
  generateItineraryId,
  listItineraries,
  upsertItinerary,
  type Itinerary,
} from "@/lib/data/itineraryStore";
import {
  deleteVehicleType,
  ensureVehicleTypeStore,
  generateVehicleTypeId,
  listVehicleTypes,
  upsertVehicleType,
  type VehicleType,
} from "@/lib/data/vehicleTypeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";

export default function DataItineraryPage() {
  const [rows, setRows] = React.useState<Itinerary[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const [typeRows, setTypeRows] = React.useState<VehicleType[]>([]);
  const [openType, setOpenType] = React.useState(false);
  const [editingTypeId, setEditingTypeId] = React.useState<string | null>(null);
  const [typeName, setTypeName] = React.useState("");
  const [typeError, setTypeError] = React.useState<string | null>(null);

  React.useEffect(() => {
    ensureItineraryStore();
    ensureVehicleTypeStore();

    const load = () => {
      setRows(listItineraries());
      setTypeRows(listVehicleTypes());
    };
    load();

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.includes("getdriver.data.itineraries")) load();
      if (e.key.includes("getdriver.data.vehicle-types")) load();
    };
    window.addEventListener("storage", onStorage);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <AppShell>
      <div className="flex-1 px-6 pb-10">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Hành Trình &amp; Loại Xe
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Quản lý danh sách hành trình và loại xe (demo).
              </p>
            </div>

            <Button
              className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              onClick={() => {
                setError(null);
                setEditingId(null);
                setName("");
                setOpen(true);
              }}
            >
              Thêm
            </Button>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2">Hành Trình</th>
                  <th className="px-3 py-2 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {rows.map((r) => (
                  <tr key={r.id} className="bg-white dark:bg-zinc-950">
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                          aria-label="Sửa"
                          onClick={() => {
                            setError(null);
                            setEditingId(r.id);
                            setName(r.name);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-red-600 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-red-400"
                          aria-label="Xoá"
                          onClick={() => {
                            deleteItinerary(r.id);
                            setRows(listItineraries());
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-3 py-8 text-center text-zinc-500"
                    >
                      Chưa có hành trình.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Loại Xe
                </div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Danh sách loại xe dùng khi tạo booking.
                </div>
              </div>
              <Button
                className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                onClick={() => {
                  setTypeError(null);
                  setEditingTypeId(null);
                  setTypeName("");
                  setOpenType(true);
                }}
              >
                Thêm
              </Button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  <tr>
                    <th className="px-3 py-2">STT</th>
                    <th className="px-3 py-2">Loại Xe</th>
                    <th className="px-3 py-2 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                  {typeRows.map((r, idx) => (
                    <tr key={r.id} className="bg-white dark:bg-zinc-950">
                      <td className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                            aria-label="Sửa"
                            onClick={() => {
                              setTypeError(null);
                              setEditingTypeId(r.id);
                              setTypeName(r.name);
                              setOpenType(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-red-600 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-red-400"
                            aria-label="Xoá"
                            onClick={() => {
                              deleteVehicleType(r.id);
                              setTypeRows(listVehicleTypes());
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {typeRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-zinc-500">
                        Chưa có loại xe.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa Hành Trình" : "Thêm Hành Trình"}</DialogTitle>
            <DialogDescription>Nhập hành trình và lưu lại.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Hành Trình</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-2 flex justify-end gap-2">
              <Button
                className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                onClick={() => {
                  setError(null);
                  if (!name.trim()) return setError("Vui lòng nhập hành trình.");

                  const all = listItineraries();
                  const id =
                    editingId ?? generateItineraryId(all.map((x) => x.id));

                  const existing = all.find((x) => x.id === id);
                  upsertItinerary({
                    id,
                    name: name.trim(),
                    createdAt: existing?.createdAt ?? Date.now(),
                  });
                  setRows(listItineraries());
                  setOpen(false);
                }}
              >
                Lưu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openType} onOpenChange={setOpenType}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTypeId ? "Sửa Loại Xe" : "Thêm Loại Xe"}
            </DialogTitle>
            <DialogDescription>Nhập loại xe và lưu lại.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Loại Xe</label>
              <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} />
            </div>

            {typeError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {typeError}
              </div>
            ) : null}

            <div className="mt-2 flex justify-end gap-2">
              <Button
                className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                onClick={() => setOpenType(false)}
              >
                Cancel
              </Button>
              <Button
                className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                onClick={() => {
                  setTypeError(null);
                  if (!typeName.trim()) return setTypeError("Vui lòng nhập loại xe.");

                  const all = listVehicleTypes();
                  const id =
                    editingTypeId ?? generateVehicleTypeId(all.map((x) => x.id));

                  const existing = all.find((x) => x.id === id);
                  upsertVehicleType({
                    id,
                    name: typeName.trim(),
                    createdAt: existing?.createdAt ?? Date.now(),
                  });
                  setTypeRows(listVehicleTypes());
                  setOpenType(false);
                }}
              >
                Lưu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

