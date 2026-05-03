"use client";

import * as React from "react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  describeTemplatePaymentRule,
  type Period,
  type RecurringExpenseTemplate,
} from "@/lib/finance/apStore";
import type { ExpenseInstance } from "@/lib/finance/apStore";
import {
  cancelUnpaidApExpensesBeforeAccrualPeriodFs,
  finalizeApTemplateEarlyFs,
  subscribeApExpenses,
  subscribeApTemplates,
  upsertApTemplateFs,
} from "@/lib/finance/apFirestore";
import { useDocLock } from "@/lib/firestore/useDocLock";

export default function OfficeExpenseCatalogPage() {
  const [templates, setTemplates] = React.useState<RecurringExpenseTemplate[]>([]);
  const [expenses, setExpenses] = React.useState<ExpenseInstance[]>([]);
  const [openAdd, setOpenAdd] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<"add" | "edit">("add");
  const [editingTplId, setEditingTplId] = React.useState<string | null>(null);
  const [openFinal, setOpenFinal] = React.useState(false);
  const [finalTplId, setFinalTplId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    name: "",
    startMonth: String(new Date().getMonth() + 1).padStart(2, "0"),
    startYear: String(new Date().getFullYear()),
    endMonth: "",
    endYear: "",
    amountVnd: "0",
    dueDayOfMonth: "5",
    accrualMonthOffset: "0" as "0" | "-1",
  });

  const lock = useDocLock({
    resource: "finance",
    resourceId: openAdd && dialogMode === "edit" ? `ap_template:${editingTplId ?? ""}` : null,
    enabled: true,
  });

  React.useEffect(() => {
    const unsubT = subscribeApTemplates(setTemplates);
    const unsubE = subscribeApExpenses(setExpenses);
    return () => {
      unsubT();
      unsubE();
    };
  }, []);

  return (
    <AppShell>
      <div className="px-6 pb-10">
        <div className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Danh Mục Chi Phí Văn Phòng
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Mỗi danh mục có <span className="font-medium text-zinc-700 dark:text-zinc-300">ngày hạn</span>{" "}
                và <span className="font-medium text-zinc-700 dark:text-zinc-300">quy tắc kỳ</span> (kỳ chi phí
                so với tháng thanh toán).
              </p>
            </div>
            <Button
              className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              onClick={() => {
                setError(null);
                setDialogMode("add");
                setEditingTplId(null);
                setForm({
                  name: "",
                  startMonth: String(new Date().getMonth() + 1).padStart(2, "0"),
                  startYear: String(new Date().getFullYear()),
                  endMonth: "",
                  endYear: "",
                  amountVnd: "0",
                  dueDayOfMonth: "5",
                  accrualMonthOffset: "0",
                });
                setOpenAdd(true);
              }}
            >
              + Thêm danh mục
            </Button>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2">STT</th>
                  <th className="px-3 py-2">Loại Chi Phí</th>
                  <th className="px-3 py-2">Kỳ Bắt Đầu</th>
                  <th className="px-3 py-2">Kỳ Kết Thúc</th>
                  <th className="px-3 py-2 min-w-[220px]">Quy Tắc Hạn / Kỳ</th>
                  <th className="px-3 py-2 text-right">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {templates.map((t, idx) => {
                    const lastPeriod: Period | undefined =
                      t.finalizedEffectiveTo ?? t.endPeriod;
                    const lastExpense =
                      lastPeriod
                        ? expenses.find(
                            (e) =>
                              e.templateId === t.id &&
                              e.accrualPeriod.month === lastPeriod.month &&
                              e.accrualPeriod.year === lastPeriod.year,
                          )
                        : undefined;
                    const isSettled =
                      Boolean(t.finalizedAt) ||
                      (Boolean(lastPeriod) && lastExpense?.status === "Paid");

                    return (
                      <tr key={t.id} className="bg-white dark:bg-zinc-950">
                        <td className="px-3 py-3">{idx + 1}</td>
                        <td className="px-3 py-3 font-medium">{t.name}</td>
                        <td className="px-3 py-3">{fmtPeriod(t.startPeriod)}</td>
                        <td className="px-3 py-3">
                          {t.endPeriod ? fmtPeriod(t.endPeriod) : "—"}
                        </td>
                        <td className="px-3 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                          {describeTemplatePaymentRule(t)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="secondary"
                              className="h-8"
                              onClick={() => {
                                setError(null);
                                setDialogMode("edit");
                                setEditingTplId(t.id);
                                setForm({
                                  name: t.name,
                                  startMonth: String(t.startPeriod.month).padStart(2, "0"),
                                  startYear: String(t.startPeriod.year),
                                  endMonth: t.endPeriod
                                    ? String(t.endPeriod.month).padStart(2, "0")
                                    : "",
                                  endYear: t.endPeriod ? String(t.endPeriod.year) : "",
                                  amountVnd: String(t.defaultAmountVnd ?? 0),
                                  dueDayOfMonth: String(t.dueDayOfMonth),
                                  accrualMonthOffset: t.accrualMonthOffset === -1 ? "-1" : "0",
                                });
                                setOpenAdd(true);
                              }}
                            >
                              Sửa
                            </Button>
                            {isSettled ? (
                              <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                                Đã Tất Toán
                              </span>
                            ) : (
                              <Button
                                variant="secondary"
                                className="h-8"
                                onClick={() => {
                                  setFinalTplId(t.id);
                                  setOpenFinal(true);
                                }}
                              >
                                Final
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {templates.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-10 text-center text-zinc-500"
                    >
                      Chưa có danh mục.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog
        open={openAdd}
        onOpenChange={(v) => {
          setOpenAdd(v);
          if (!v) {
            setEditingTplId(null);
            setDialogMode("add");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "edit"
                ? "Sửa danh mục chi phí văn phòng"
                : "Thêm danh mục chi phí văn phòng"}
            </DialogTitle>
            <DialogDescription>
              Kỳ (MM/YYYY) là kỳ ghi nhận chi phí. Ngày hạn và quy tắc kỳ quyết định đến tháng nào phải trả
              tiền cho kỳ đó.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {dialogMode === "edit" && editingTplId ? (
              !lock.isReady ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                  Đang kiểm tra lock…
                </div>
              ) : lock.canEdit ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                  Bạn đang sửa danh mục này.
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  Danh mục đang được sửa bởi <b>{lock.lockedByName ?? "—"}</b>.
                </div>
              )
            ) : null}
            <Field label="Loại chi phí">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ví dụ: Thuê văn phòng, Lương kế toán, Phí ngân hàng…"
              />
            </Field>

            <Field label="Số tiền mặc định (VND)">
              <Input
                value={form.amountVnd}
                onChange={(e) => setForm({ ...form, amountVnd: e.target.value })}
                inputMode="numeric"
              />
            </Field>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Ngày đến hạn trong tháng thanh toán (1–31)">
                <Input
                  value={form.dueDayOfMonth}
                  onChange={(e) => setForm({ ...form, dueDayOfMonth: e.target.value })}
                  inputMode="numeric"
                  placeholder="5"
                />
              </Field>
              <Field label="Kỳ chi phí so với tháng chứa ngày hạn">
                <select
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                  value={form.accrualMonthOffset}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      accrualMonthOffset: e.target.value as "0" | "-1",
                    })
                  }
                >
                  <option value="0">Cùng tháng — kỳ = tháng có ngày hạn</option>
                  <option value="-1">Tháng trước — ngày hạn tháng M trả cho kỳ M−1</option>
                </select>
              </Field>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Kỳ hiệu lực (MM / YYYY)
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <AlignedField label="Bắt đầu (MM)">
                  <Input
                    className="h-10"
                    value={form.startMonth}
                    onChange={(e) =>
                      setForm({ ...form, startMonth: e.target.value })
                    }
                    inputMode="numeric"
                    placeholder="05"
                  />
                </AlignedField>
                <AlignedField label="Bắt đầu (YYYY)">
                  <Input
                    className="h-10"
                    value={form.startYear}
                    onChange={(e) =>
                      setForm({ ...form, startYear: e.target.value })
                    }
                    inputMode="numeric"
                    placeholder="2026"
                  />
                </AlignedField>
                <AlignedField label="Kết thúc (MM)">
                  <Input
                    className="h-10"
                    value={form.endMonth}
                    onChange={(e) =>
                      setForm({ ...form, endMonth: e.target.value })
                    }
                    inputMode="numeric"
                    placeholder="(tuỳ chọn)"
                  />
                </AlignedField>
                <AlignedField label="Kết thúc (YYYY)">
                  <Input
                    className="h-10"
                    value={form.endYear}
                    onChange={(e) =>
                      setForm({ ...form, endYear: e.target.value })
                    }
                    inputMode="numeric"
                    placeholder="(tuỳ chọn)"
                  />
                </AlignedField>
              </div>
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                onClick={() => setOpenAdd(false)}
              >
                Huỷ
              </Button>
              <Button
                className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
                disabled={Boolean(dialogMode === "edit" && editingTplId && lock.isReady && !lock.canEdit)}
                onClick={() => {
                  setError(null);
                  if (dialogMode === "edit" && editingTplId && lock.isReady && !lock.canEdit) {
                    return setError(`Danh mục đang được sửa bởi ${lock.lockedByName ?? "—"}.`);
                  }
                  if (!form.name.trim()) {
                    return setError("Vui lòng nhập tên loại chi phí.");
                  }
                  const start = parsePeriod(form.startMonth, form.startYear);
                  if (!start) return setError("Kỳ bắt đầu không hợp lệ.");
                  const end =
                    form.endMonth.trim() || form.endYear.trim()
                      ? parsePeriod(form.endMonth, form.endYear)
                      : undefined;
                  if ((form.endMonth.trim() || form.endYear.trim()) && !end) {
                    return setError("Kỳ kết thúc không hợp lệ.");
                  }
                  if (end && comparePeriod(end, start).lt) {
                    return setError("Kỳ kết thúc phải >= kỳ bắt đầu.");
                  }
                  const amount = Number(form.amountVnd.replace(/[^\d]/g, ""));
                  if (!Number.isFinite(amount) || amount < 0) {
                    return setError("Số tiền không hợp lệ.");
                  }
                  const dueDay = Number(form.dueDayOfMonth);
                  if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
                    return setError("Ngày đến hạn phải từ 1 đến 31.");
                  }
                  const offset: 0 | -1 =
                    form.accrualMonthOffset === "-1" ? -1 : 0;

                  const now = Date.now();
                  const existingEdit =
                    dialogMode === "edit" && editingTplId
                      ? templates.find((x) => x.id === editingTplId)
                      : undefined;

                  const id =
                    dialogMode === "edit" && editingTplId
                      ? editingTplId
                      : `TPL-${now}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;

                  const tpl: RecurringExpenseTemplate = {
                    id,
                    name: form.name.trim(),
                    defaultAmountVnd: amount,
                    currency: "VND",
                    dueDayOfMonth: dueDay,
                    accrualMonthOffset: offset,
                    active: existingEdit?.active ?? true,
                    startPeriod: start,
                    endPeriod: end ?? undefined,
                    finalizedAt:
                      dialogMode === "edit" ? existingEdit?.finalizedAt : undefined,
                    finalizedBy:
                      dialogMode === "edit" ? existingEdit?.finalizedBy : undefined,
                    finalizedEffectiveTo:
                      dialogMode === "edit"
                        ? existingEdit?.finalizedEffectiveTo
                        : undefined,
                    createdAt: existingEdit?.createdAt ?? now,
                    updatedAt: now,
                  };
                  (async () => {
                    try {
                      await upsertApTemplateFs(tpl);
                      if (dialogMode === "edit") {
                        await cancelUnpaidApExpensesBeforeAccrualPeriodFs({
                          templateId: tpl.id,
                          minAccrualPeriod: start,
                          existingExpenses: expenses,
                        });
                      }
                      setOpenAdd(false);
                    } catch (e) {
                      const msg = String((e as any)?.message ?? e ?? "unknown");
                      setError(`Không thể lưu danh mục. (${msg})`);
                    }
                  })();
                }}
              >
                Lưu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openFinal}
        onOpenChange={(v) => {
          setOpenFinal(v);
          if (!v) setFinalTplId(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Kết thúc trước hạn</DialogTitle>
            <DialogDescription>
              Bạn muốn **kết thúc trước hạn (ngừng phát sinh kỳ sau)**?
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              onClick={() => setOpenFinal(false)}
            >
              Huỷ
            </Button>
            <Button
              className="h-9 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              onClick={() => {
                if (!finalTplId) return;
                const now = new Date();
                const effectiveTo: Period = { month: now.getMonth() + 1, year: now.getFullYear() };
                void finalizeApTemplateEarlyFs({
                  templateId: finalTplId,
                  effectiveTo,
                  templates,
                  existingExpenses: expenses,
                });
                setOpenFinal(false);
              }}
            >
              Đúng
            </Button>
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

/** Nhãn cùng chiều cao + ô cố định h-10 để một hàng MM/YYYY thẳng cột. */
function AlignedField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="flex min-h-[2.75rem] items-end text-sm font-medium leading-snug text-zinc-800 dark:text-zinc-200">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function fmtPeriod(p: Period) {
  return `${String(p.month).padStart(2, "0")}/${p.year}`;
}

function parsePeriod(mm: string, yyyy: string): Period | null {
  const month = Number(mm);
  const year = Number(yyyy);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return null;
  return { month, year };
}

function comparePeriod(a: Period, b: Period) {
  const av = a.year * 100 + a.month;
  const bv = b.year * 100 + b.month;
  return { lt: av < bv, eq: av === bv, gt: av > bv };
}

