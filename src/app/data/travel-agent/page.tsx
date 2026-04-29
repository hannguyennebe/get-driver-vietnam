"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import {
  deleteTravelAgent,
  ensurePartnersStore,
  generateTravelAgentId,
  listTravelAgents,
  upsertTravelAgent,
  type PartnerPaymentTerms,
  type TravelAgent,
} from "@/lib/data/partnersStore";
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

export default function TravelAgentPage() {
  const [agents, setAgents] = React.useState<TravelAgent[]>([]);
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    name: "",
    businessModel: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    paymentType: "Công Nợ" as "Phải Trả" | "Công Nợ",
    taxIncluded: "Có" as "Không" | "Có",
    terms: { mode: "MONTHLY", payDay: 10, offsetMonths: 1 } as PartnerPaymentTerms,
  });

  React.useEffect(() => {
    ensurePartnersStore();
    const load = () => setAgents(listTravelAgents());
    load();

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.includes("getdriver.data.partners")) load();
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
                Travel Agent
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Danh sách đại lý (demo).
              </p>
            </div>

            <Button
              className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              onClick={() => {
                setError(null);
                setEditingId(null);
                setForm({
                  name: "",
                  businessModel: "",
                  contactName: "",
                  phone: "",
                  email: "",
                  address: "",
                  website: "",
                  paymentType: "Công Nợ",
                  taxIncluded: "Có",
                  terms: { mode: "MONTHLY", payDay: 10, offsetMonths: 1 },
                });
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
                  <th className="px-3 py-2">Tên Đại Lý</th>
                  <th className="px-3 py-2">Mô Hình Kinh Doanh</th>
                  <th className="px-3 py-2">Người liên hệ</th>
                  <th className="px-3 py-2">SĐT</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Địa chỉ</th>
                  <th className="px-3 py-2">Website</th>
                  <th className="px-3 py-2">Hình thức thanh toán</th>
                  <th className="px-3 py-2">Thuế</th>
                  <th className="px-3 py-2 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {agents.map((a) => (
                  <tr key={a.id} className="bg-white dark:bg-zinc-950">
                    <td className="px-3 py-2 font-medium">{a.name}</td>
                    <td className="px-3 py-2">{a.businessModel ?? "—"}</td>
                    <td className="px-3 py-2">{a.contactName ?? "—"}</td>
                    <td className="px-3 py-2">{a.phone ?? "—"}</td>
                    <td className="px-3 py-2">{a.email ?? "—"}</td>
                    <td className="px-3 py-2">{a.address ?? "—"}</td>
                    <td className="px-3 py-2">{a.website ?? "—"}</td>
                    <td className="px-3 py-2">{a.paymentType ?? "—"}</td>
                    <td className="px-3 py-2">{a.taxIncluded ? "Có" : "Không"}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                          aria-label="Sửa"
                          onClick={() => {
                            setError(null);
                            setEditingId(a.id);
                            setForm({
                              name: a.name ?? "",
                              businessModel: a.businessModel ?? "",
                              contactName: a.contactName ?? "",
                              phone: a.phone ?? "",
                              email: a.email ?? "",
                              address: a.address ?? "",
                              website: a.website ?? "",
                              paymentType: a.paymentType ?? "Công Nợ",
                              taxIncluded: a.taxIncluded ? "Có" : "Không",
                              terms:
                                a.paymentType === "Phải Trả"
                                  ? { mode: "NEXT_DAY" }
                                  : a.paymentTerms?.mode === "MONTHLY"
                                    ? a.paymentTerms
                                    : { mode: "MONTHLY", payDay: 10, offsetMonths: 1 },
                            });
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
                            deleteTravelAgent(a.id);
                            setAgents(listTravelAgents());
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {agents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-8 text-center text-zinc-500"
                    >
                      Chưa có Travel Agent.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Sửa Travel Agent" : "Thêm Travel Agent"}
            </DialogTitle>
            <DialogDescription>
              Nhập thông tin đại lý và lưu lại.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Field label="Tên Đại Lý">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Mô Hình Kinh Doanh">
              <Input
                value={form.businessModel}
                onChange={(e) =>
                  setForm({ ...form, businessModel: e.target.value })
                }
                placeholder="B2B / B2C ..."
              />
            </Field>
            <Field label="Người liên hệ">
              <Input
                value={form.contactName}
                onChange={(e) =>
                  setForm({ ...form, contactName: e.target.value })
                }
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="SĐT">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0909..."
                />
              </Field>
              <Field label="Email">
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@..."
                />
              </Field>
            </div>
            <Field label="Địa chỉ">
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="TPHCM / Hà Nội..."
              />
            </Field>
            <Field label="Website">
              <Input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="example.com"
              />
            </Field>
            <Field label="Hình thức thanh toán">
              <div className="flex items-center gap-6 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={form.paymentType === "Phải Trả"}
                    onChange={() =>
                      setForm({ ...form, paymentType: "Phải Trả", terms: { mode: "NEXT_DAY" } })
                    }
                  />
                  Phải Trả
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={form.paymentType === "Công Nợ"}
                    onChange={() =>
                      setForm({
                        ...form,
                        paymentType: "Công Nợ",
                        terms:
                          form.terms.mode === "MONTHLY"
                            ? form.terms
                            : { mode: "MONTHLY", payDay: 10, offsetMonths: 1 },
                      })
                    }
                  />
                  Công Nợ
                </label>
              </div>
            </Field>

            <Field label="Quy tắc hạn thanh toán">
              {form.paymentType === "Phải Trả" ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  Hạn thanh toán = <b>ngày hôm sau</b> so với <b>ngày đi</b> của booking (T+1).
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Ngày trả trong tháng</div>
                    <Input
                      value={form.terms.mode === "MONTHLY" ? String(form.terms.payDay) : "10"}
                      onChange={(e) => {
                        const payDay = Number(e.target.value.replace(/[^\d]/g, ""));
                        setForm({
                          ...form,
                          terms: { mode: "MONTHLY", payDay: payDay || 10, offsetMonths: 1 },
                        });
                      }}
                      inputMode="numeric"
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Kỳ công nợ</div>
                    <select
                      className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                      value={form.terms.mode === "MONTHLY" ? String(form.terms.offsetMonths) : "1"}
                      onChange={(e) => {
                        const offsetMonths = Number(e.target.value);
                        const payDay = form.terms.mode === "MONTHLY" ? form.terms.payDay : 10;
                        setForm({
                          ...form,
                          terms: { mode: "MONTHLY", payDay, offsetMonths: Number.isFinite(offsetMonths) ? offsetMonths : 1 },
                        });
                      }}
                    >
                      <option value="0">Cùng tháng</option>
                      <option value="1">Tháng trước</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                    {(() => {
                      const payDay = form.terms.mode === "MONTHLY" ? form.terms.payDay : 10;
                      const off = form.terms.mode === "MONTHLY" ? form.terms.offsetMonths : 1;
                      return off === 0
                        ? `Ngày ${payDay} trả công nợ của tháng này.`
                        : `Ngày ${payDay} trả công nợ của tháng trước.`;
                    })()}
                  </div>
                </div>
              )}
            </Field>

            <Field label="Thuế">
              <div className="flex items-center gap-6 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={form.taxIncluded === "Không"}
                    onChange={() => setForm({ ...form, taxIncluded: "Không" })}
                  />
                  Không
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={form.taxIncluded === "Có"}
                    onChange={() => setForm({ ...form, taxIncluded: "Có" })}
                  />
                  Có
                </label>
              </div>
            </Field>

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
                  if (!form.name.trim())
                    return setError("Vui lòng nhập Tên Đại Lý.");

                  const id =
                    editingId ??
                    generateTravelAgentId(agents.map((x) => x.id));

                  upsertTravelAgent({
                    id,
                    name: form.name.trim(),
                    businessModel: form.businessModel.trim() || undefined,
                    contactName: form.contactName.trim() || undefined,
                    phone: form.phone.trim() || undefined,
                    email: form.email.trim() || undefined,
                    address: form.address.trim() || undefined,
                    website: form.website.trim() || undefined,
                    paymentType: form.paymentType,
                    taxIncluded: form.taxIncluded === "Có",
                    paymentTerms: form.terms,
                  });
                  setAgents(listTravelAgents());
                  setOpen(false);
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

