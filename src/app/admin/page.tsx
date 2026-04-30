"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  deleteUser,
  generateEmployeeCode,
  listUsers,
  PERMISSION_CATALOG,
  upsertUser,
  type AdminUser,
  type UserRole,
} from "@/lib/admin/usersStore";
import { getDemoSession } from "@/lib/auth/demo";
import { initFirebaseAuth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Home, Pencil, Share2 } from "lucide-react";
import { getCompanyInfo, setCompanyInfo, type CompanyInfo } from "@/lib/admin/companyStore";
import { getPaymentInfo, setPaymentInfo, type PaymentAccount, type PaymentInfo } from "@/lib/admin/paymentStore";

type CreateForm = {
  employeeCode: string;
  name: string;
  phone: string;
  role: UserRole;
  password: string;
  permissions: {
    view: string[];
    edit: string[];
  };
};

type EditForm = {
  uid?: string;
  employeeCode: string;
  name: string;
  phone: string;
  role: UserRole;
  active: boolean;
};

function formatPhone84(raw: string) {
  let s = raw.trim();
  if (!s) return "";
  if (!s.startsWith("+")) s = s.replace(/\D/g, "");
  if (s.startsWith("84")) s = `+${s}`;
  if (s.startsWith("0")) s = `+84${s.slice(1)}`;
  if (!s.startsWith("+84")) s = s; // leave as-is if user pasted full +country
  return s;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [cleanupBusy, setCleanupBusy] = React.useState(false);
  const [salesMigrateBusy, setSalesMigrateBusy] = React.useState(false);
  const [openCreate, setOpenCreate] = React.useState(false);
  const [openPerms, setOpenPerms] = React.useState(false);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [permsUser, setPermsUser] = React.useState<AdminUser | null>(null);
  const [editUser, setEditUser] = React.useState<AdminUser | null>(null);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<CreateForm>({
    employeeCode: "",
    name: "",
    phone: "+84",
    role: "Operator",
    password: "",
    permissions: { view: [], edit: [] },
  });
  const [infoTab, setInfoTab] = React.useState<"company" | "payment">("company");
  const [company, setCompany] = React.useState<CompanyInfo | null>(null);
  const [companyDraft, setCompanyDraft] = React.useState<CompanyInfo | null>(null);
  const [editingCompany, setEditingCompany] = React.useState(false);
  const [payment, setPayment] = React.useState<PaymentInfo | null>(null);
  const [paymentDraft, setPaymentDraft] = React.useState<PaymentInfo | null>(null);
  const [editingPaymentKey, setEditingPaymentKey] = React.useState<
    "vatVnd" | "noVatVnd" | "usd" | null
  >(null);
  const [apiMode, setApiMode] = React.useState(false);
  const [editForm, setEditForm] = React.useState<EditForm>({
    uid: undefined,
    employeeCode: "",
    name: "",
    phone: "+84",
    role: "Operator",
    active: true,
  });

  React.useEffect(() => {
    const session = getDemoSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const canInfo =
      session.role === "Admin" || Boolean(session.permissions?.view?.includes("admin.info"));
    const canManage =
      session.role === "Admin" || Boolean(session.permissions?.view?.includes("admin.manage"));
    if (!canInfo && !canManage) {
      router.replace("/dashboard");
      return;
    }
    setUsers(listUsers());
    const info = getCompanyInfo();
    setCompany(info);
    setCompanyDraft(info);
    const pay = getPaymentInfo();
    setPayment(pay);
    setPaymentDraft(pay);
    void loadUsersFromApi();
  }, [router]);

  const session = typeof window !== "undefined" ? getDemoSession() : null;
  const canInfo =
    session?.role === "Admin" || Boolean(session?.permissions?.view?.includes("admin.info"));
  const canManage =
    session?.role === "Admin" || Boolean(session?.permissions?.view?.includes("admin.manage"));

  async function cleanupOrphanDriverWallets() {
    setCleanupBusy(true);
    try {
      const res = await fetch("/api/admin/cleanup-orphan-driver-wallets", { method: "POST" });
      const data = (await res.json()) as any;
      if (!res.ok || !data?.ok) {
        const msg = String(data?.error ?? "failed");
        alert(`Không dọn được ví mồ côi. (${msg})`);
        return;
      }
      const deleted = Array.isArray(data?.deletedKeys) ? data.deletedKeys.length : 0;
      alert(`Đã xoá ${deleted} ví mồ côi.`);
    } catch (e) {
      alert(`Không dọn được ví mồ côi. (${String((e as any)?.message ?? "unknown")})`);
    } finally {
      setCleanupBusy(false);
    }
  }

  async function migrateReservationSales() {
    setSalesMigrateBusy(true);
    try {
      const res = await fetch("/api/admin/migrate-reservation-sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 2000 }),
      });
      const data = (await res.json()) as any;
      if (!res.ok || !data?.ok) {
        const msg = String(data?.error ?? data?.message ?? "failed");
        alert(`Không migrate được Sales. (${msg})`);
        return;
      }
      alert(`Đã cập nhật Sales cho ${Number(data?.updatedCount ?? 0) || 0} booking.`);
    } catch (e) {
      alert(`Không migrate được Sales. (${String((e as any)?.message ?? "unknown")})`);
    } finally {
      setSalesMigrateBusy(false);
    }
  }

  async function authHeader() {
    const auth = await initFirebaseAuth();
    const token = await auth?.currentUser?.getIdToken();
    if (!token) return null;
    return { authorization: `Bearer ${token}` };
  }

  async function loadUsersFromApi() {
    try {
      const headers = await authHeader();
      if (!headers) return;
      const res = await fetch("/api/admin/users", { headers });
      if (!res.ok) return;
      const data = (await res.json()) as { users?: AdminUser[] };
      if (Array.isArray(data.users)) {
        setUsers(data.users);
        setApiMode(true);
      }
    } catch {
      // keep local fallback
    }
  }

  function openCreateDialog() {
    setCreateError(null);
    const nextCode = generateEmployeeCode(listUsers().map((u) => u.employeeCode));
    setForm({
      employeeCode: nextCode,
      name: "",
      phone: "+84",
      role: "Operator",
      password: "",
      permissions: { view: [], edit: [] },
    });
    setOpenCreate(true);
  }

  function refresh() {
    if (apiMode) {
      void loadUsersFromApi();
      return;
    }
    setUsers(listUsers());
  }

  function openPermissions(user: AdminUser) {
    setPermsUser(user);
    setOpenPerms(true);
  }

  function openEditDialog(user: AdminUser) {
    setEditError(null);
    setEditUser(user);
    setEditForm({
      uid: user.uid,
      employeeCode: user.employeeCode,
      name: user.name,
      phone: user.phone,
      role: user.role,
      active: user.active,
    });
    setOpenEdit(true);
  }

  function saveEditUser() {
    setEditError(null);
    const name = editForm.name.trim();
    const phone = formatPhone84(editForm.phone);
    if (!name) {
      setEditError("Vui lòng nhập Tên Nhân Viên.");
      return;
    }
    if (!phone || phone === "+84") {
      setEditError("Vui lòng nhập Số Điện Thoại hợp lệ.");
      return;
    }
    if (!editUser) return;

    if (editForm.uid) {
      void (async () => {
        const uid = editForm.uid;
        if (!uid) return;
        const headers = await authHeader();
        if (!headers) {
          setEditError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
          return;
        }
        const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify({
            name,
            phone,
            role: editForm.role,
            active: editForm.active,
          }),
        });
        if (!res.ok) {
          const d = (await res.json().catch(() => ({}))) as { error?: string };
          setEditError(
            d.error === "auth/phone-number-already-exists"
              ? "Số điện thoại đã tồn tại trên Firebase."
              : "Không thể cập nhật user. Vui lòng thử lại.",
          );
          return;
        }
        refresh();
        setOpenEdit(false);
      })();
      return;
    }

    const now = Date.now();
    upsertUser({
      ...editUser,
      name,
      phone,
      role: editForm.role,
      active: editForm.active,
      updatedAt: now,
    });
    refresh();
    setOpenEdit(false);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 pb-10">
      <div className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Thông Tin &amp; Quản Trị
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Quản lý thông tin công ty, người dùng và tài khoản thanh toán
            </p>
          </div>

          <button
            type="button"
            className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
            aria-label="Về màn hình chính"
            onClick={() => router.push("/dashboard")}
          >
            <Home className="h-4 w-4" />
          </button>
        </div>
      </div>

      {canManage ? (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Quản Trị
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Quản lý tài khoản người dùng
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {session?.role === "Admin" ? (
              <Button
                variant="secondary"
                className="h-9"
                disabled={cleanupBusy}
                onClick={() => {
                  const ok = window.confirm(
                    "Xoá toàn bộ ví tài xế mồ côi (không còn driver tương ứng)? Hành động không thể hoàn tác.",
                  );
                  if (!ok) return;
                  void cleanupOrphanDriverWallets();
                }}
              >
                {cleanupBusy ? "Đang dọn ví…" : "Dọn ví mồ côi"}
              </Button>
            ) : null}
            {session?.role === "Admin" ? (
              <Button
                variant="secondary"
                className="h-9"
                disabled={salesMigrateBusy}
                onClick={() => {
                  const ok = window.confirm(
                    "Chuẩn hoá Sales của các booking cũ: nếu Sales đang là SĐT và trùng SĐT nhân viên thì đổi sang Tên nhân viên. Tiếp tục?",
                  );
                  if (!ok) return;
                  void migrateReservationSales();
                }}
              >
                {salesMigrateBusy ? "Đang cập nhật Sales…" : "Chuẩn hoá Sales (tên NV)"}
              </Button>
            ) : null}
            <Button
              className="h-9 px-3 text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              onClick={openCreateDialog}
            >
              + Tạo User
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
              <tr>
                <th className="px-3 py-2">Mã NV</th>
                <th className="px-3 py-2">Tên Nhân Viên</th>
                <th className="px-3 py-2">Số Điện Thoại</th>
                <th className="px-3 py-2">Vai Trò</th>
                <th className="px-3 py-2">Trạng Thái</th>
                <th className="px-3 py-2">Phân Quyền</th>
                <th className="px-3 py-2">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {users.map((u) => (
                <tr key={u.employeeCode} className="bg-white dark:bg-zinc-950">
                  <td className="px-3 py-2 font-mono text-xs">{u.employeeCode}</td>
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="px-3 py-2">{u.phone}</td>
                  <td className="px-3 py-2">{u.role}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        u.active
                          ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      }
                    >
                      {u.active ? "Hoạt Động" : "Không Hoạt Động"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="secondary"
                      className="h-8 px-3"
                      onClick={() => openPermissions(u)}
                    >
                      Xem / Sửa
                    </Button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="h-8 px-3"
                        onClick={() => openEditDialog(u)}
                      >
                        Sửa
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-8 px-3"
                        onClick={() => {
                  if (u.uid) {
                            void (async () => {
                              const headers = await authHeader();
                              if (!headers) return;
                              await fetch(`/api/admin/users/${encodeURIComponent(u.uid!)}`, {
                                method: "DELETE",
                                headers,
                              });
                              refresh();
                            })();
                            return;
                          }
                          deleteUser(u.employeeCode);
                          refresh();
                        }}
                      >
                        Xoá
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-6 text-center text-sm text-zinc-500"
                  >
                    Chưa có user nào.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      ) : null}

      {canInfo ? (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Thông Tin
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Quản lý thông tin công ty và tài khoản thanh toán
          </p>
        </div>

        <div className="mt-4 rounded-full bg-zinc-100 p-1 text-sm dark:bg-zinc-900">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setInfoTab("company")}
              className={
                infoTab === "company"
                  ? "relative rounded-full bg-white px-3 py-2 pr-10 text-zinc-900 shadow-sm ring-2 ring-orange-400 dark:bg-zinc-950 dark:text-zinc-50"
                  : "rounded-full px-3 py-2 text-zinc-600 hover:bg-white/60 dark:text-zinc-300 dark:hover:bg-zinc-950/40"
              }
            >
              Thông Tin Công Ty
              {infoTab === "company" ? (
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                  role="button"
                  tabIndex={0}
                  aria-label="Sửa thông tin công ty"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!company) return;
                    if (!editingCompany) {
                      setCompanyDraft(company);
                      setEditingCompany(true);
                    } else {
                      setEditingCompany(false);
                      setCompanyDraft(company);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (!company) return;
                    if (!editingCompany) {
                      setCompanyDraft(company);
                      setEditingCompany(true);
                    } else {
                      setEditingCompany(false);
                      setCompanyDraft(company);
                    }
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setInfoTab("payment")}
              className={
                infoTab === "payment"
                  ? "rounded-full bg-white px-3 py-2 text-zinc-900 shadow-sm ring-2 ring-orange-400 dark:bg-zinc-950 dark:text-zinc-50"
                  : "rounded-full px-3 py-2 text-zinc-600 hover:bg-white/60 dark:text-zinc-300 dark:hover:bg-zinc-950/40"
              }
            >
              Thông Tin Tài Khoản Thanh Toán
            </button>
          </div>
        </div>

        {infoTab === "company" ? (
          <div className="mt-4">
            <div className={!editingCompany ? "pointer-events-none select-none" : ""}>
              <div className="mt-2 grid gap-4 md:grid-cols-2">
                <Field
                  label="Tên Công Ty"
                  value={companyDraft?.name ?? ""}
                  disabled={!editingCompany}
                  onChange={(v) =>
                    setCompanyDraft((s) => (s ? { ...s, name: v } : s))
                  }
                />
                <Field
                  label="Số Điện Thoại"
                  value={companyDraft?.phone ?? ""}
                  disabled={!editingCompany}
                  onChange={(v) =>
                    setCompanyDraft((s) => (s ? { ...s, phone: v } : s))
                  }
                />
                <Field
                  label="Email"
                  value={companyDraft?.email ?? ""}
                  disabled={!editingCompany}
                  onChange={(v) =>
                    setCompanyDraft((s) => (s ? { ...s, email: v } : s))
                  }
                />
                <Field
                  label="Website"
                  value={companyDraft?.website ?? ""}
                  disabled={!editingCompany}
                  onChange={(v) =>
                    setCompanyDraft((s) => (s ? { ...s, website: v } : s))
                  }
                />
              </div>

              <div className="mt-4 grid gap-4">
                <Field
                  label="Người Đại Diện"
                  value={companyDraft?.representative ?? ""}
                  disabled={!editingCompany}
                  onChange={(v) =>
                    setCompanyDraft((s) =>
                      s ? { ...s, representative: v } : s,
                    )
                  }
                />
                <Field
                  label="Địa Chỉ"
                  value={companyDraft?.address ?? ""}
                  disabled={!editingCompany}
                  onChange={(v) =>
                    setCompanyDraft((s) => (s ? { ...s, address: v } : s))
                  }
                />
                <Field
                  label="Mã Số Thuế"
                  value={companyDraft?.taxCode ?? ""}
                  disabled={!editingCompany}
                  onChange={(v) =>
                    setCompanyDraft((s) => (s ? { ...s, taxCode: v } : s))
                  }
                />
              </div>
            </div>

            {editingCompany ? (
              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  className="h-9"
                  onClick={() => {
                    setEditingCompany(false);
                    setCompanyDraft(company);
                  }}
                >
                  Huỷ
                </Button>
                <Button
                  className="h-9 bg-orange-500 text-white hover:bg-orange-600"
                  onClick={() => {
                    if (!companyDraft) return;
                    const next = { ...companyDraft, updatedAt: Date.now() };
                    setCompanyInfo(next);
                    setCompany(next);
                    setCompanyDraft(next);
                    setEditingCompany(false);
                  }}
                >
                  Lưu
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            <PaymentCard
              title="Tài Khoản VAT - VND"
              account={paymentDraft?.vatVnd}
              editing={editingPaymentKey === "vatVnd"}
              onEditToggle={() => {
                if (!payment) return;
                if (editingPaymentKey === "vatVnd") {
                  setEditingPaymentKey(null);
                  setPaymentDraft(payment);
                } else {
                  setPaymentDraft(payment);
                  setEditingPaymentKey("vatVnd");
                }
              }}
              onShare={() => {
                if (!paymentDraft) return;
                shareAccount("Tài Khoản VAT - VND", paymentDraft.vatVnd);
              }}
              onChange={(next) =>
                setPaymentDraft((s) => (s ? { ...s, vatVnd: next } : s))
              }
              onCancel={() => {
                setEditingPaymentKey(null);
                setPaymentDraft(payment);
              }}
              onSave={() => {
                if (!paymentDraft) return;
                const now = Date.now();
                const next: PaymentInfo = {
                  ...paymentDraft,
                  vatVnd: { ...paymentDraft.vatVnd, updatedAt: now },
                };
                setPaymentInfo(next);
                setPayment(next);
                setPaymentDraft(next);
                setEditingPaymentKey(null);
              }}
            />

            <PaymentCard
              title="Tài Khoản No VAT - VND"
              account={paymentDraft?.noVatVnd}
              editing={editingPaymentKey === "noVatVnd"}
              onEditToggle={() => {
                if (!payment) return;
                if (editingPaymentKey === "noVatVnd") {
                  setEditingPaymentKey(null);
                  setPaymentDraft(payment);
                } else {
                  setPaymentDraft(payment);
                  setEditingPaymentKey("noVatVnd");
                }
              }}
              onShare={() => {
                if (!paymentDraft) return;
                shareAccount("Tài Khoản No VAT - VND", paymentDraft.noVatVnd);
              }}
              onChange={(next) =>
                setPaymentDraft((s) => (s ? { ...s, noVatVnd: next } : s))
              }
              onCancel={() => {
                setEditingPaymentKey(null);
                setPaymentDraft(payment);
              }}
              onSave={() => {
                if (!paymentDraft) return;
                const now = Date.now();
                const next: PaymentInfo = {
                  ...paymentDraft,
                  noVatVnd: { ...paymentDraft.noVatVnd, updatedAt: now },
                };
                setPaymentInfo(next);
                setPayment(next);
                setPaymentDraft(next);
                setEditingPaymentKey(null);
              }}
            />

            <PaymentCard
              title="Tài Khoản USD"
              account={paymentDraft?.usd}
              editing={editingPaymentKey === "usd"}
              onEditToggle={() => {
                if (!payment) return;
                if (editingPaymentKey === "usd") {
                  setEditingPaymentKey(null);
                  setPaymentDraft(payment);
                } else {
                  setPaymentDraft(payment);
                  setEditingPaymentKey("usd");
                }
              }}
              onShare={() => {
                if (!paymentDraft) return;
                shareAccount("Tài Khoản USD", paymentDraft.usd);
              }}
              onChange={(next) =>
                setPaymentDraft((s) => (s ? { ...s, usd: next } : s))
              }
              onCancel={() => {
                setEditingPaymentKey(null);
                setPaymentDraft(payment);
              }}
              onSave={() => {
                if (!paymentDraft) return;
                const now = Date.now();
                const next: PaymentInfo = {
                  ...paymentDraft,
                  usd: { ...paymentDraft.usd, updatedAt: now },
                };
                setPaymentInfo(next);
                setPayment(next);
                setPaymentDraft(next);
                setEditingPaymentKey(null);
              }}
            />
          </div>
        )}
      </div>
      ) : null}

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo User</DialogTitle>
            <DialogDescription>
              Tạo tài khoản nhân viên để đăng nhập hệ thống.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Mã Nhân Viên</label>
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
                onChange={(e) =>
                  setForm({ ...form, phone: formatPhone84(e.target.value) })
                }
                placeholder="+84xxxxxxxxx"
              />
              <div className="text-xs text-zinc-500">
                Số điện thoại này sẽ dùng để đăng nhập.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Vai Trò</label>
              <select
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                value={form.role}
                onChange={(e) =>
                  setForm((prev) => {
                    const nextRole = e.target.value as UserRole;
                    if (nextRole === "Admin") {
                      const all = PERMISSION_CATALOG.map((p) => p.id);
                      return {
                        ...prev,
                        role: nextRole,
                        permissions: { view: all, edit: all },
                      };
                    }
                    return { ...prev, role: nextRole };
                  })
                }
              >
                <option value="Admin">Admin</option>
                <option value="Accountant">Accountant</option>
                <option value="Sales">Sales</option>
                <option value="Operator">Operator</option>
                <option value="Driver">Driver</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Phân quyền theo thư mục
              </label>
              <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                    <tr>
                      <th className="px-3 py-2">Mục</th>
                      <th className="px-3 py-2">Xem</th>
                      <th className="px-3 py-2">Sửa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {PERMISSION_CATALOG.map((p) => {
                      const canView = form.permissions.view.includes(p.id);
                      const canEdit = form.permissions.edit.includes(p.id);
                      return (
                        <tr key={`create-${p.id}`}>
                          <td className="px-3 py-2">{p.label}</td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={canView}
                              disabled={form.role === "Admin"}
                              onChange={(e) => {
                                const next = e.target.checked;
                                const view = next
                                  ? Array.from(new Set([...form.permissions.view, p.id]))
                                  : form.permissions.view.filter((x) => x !== p.id);
                                const edit = next
                                  ? form.permissions.edit
                                  : form.permissions.edit.filter((x) => x !== p.id);
                                setForm((prev) => ({
                                  ...prev,
                                  permissions: { view, edit },
                                }));
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={canEdit}
                              disabled={!canView || form.role === "Admin"}
                              onChange={(e) => {
                                const next = e.target.checked;
                                const edit = next
                                  ? Array.from(new Set([...form.permissions.edit, p.id]))
                                  : form.permissions.edit.filter((x) => x !== p.id);
                                const view = Array.from(
                                  new Set([...form.permissions.view, p.id]),
                                );
                                setForm((prev) => ({
                                  ...prev,
                                  permissions: { view, edit },
                                }));
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {form.role === "Admin" ? (
                <div className="text-xs text-zinc-500">
                  Admin mặc định có toàn bộ quyền xem/sửa.
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Mật khẩu</label>
              <Input
                value={form.password}
                type="password"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            {createError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            ) : null}

            <Button
              className="w-full text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              onClick={() => {
                setCreateError(null);
                const name = form.name.trim();
                const phone = formatPhone84(form.phone);
                if (!name) {
                  setCreateError("Vui lòng nhập Tên Nhân Viên.");
                  return;
                }
                if (!phone || phone === "+84") {
                  setCreateError("Vui lòng nhập Số Điện Thoại hợp lệ.");
                  return;
                }
                if (!form.password || form.password.length < 6) {
                  setCreateError("Mật khẩu tối thiểu 6 ký tự.");
                  return;
                }

                const now = Date.now();
                const existing = listUsers();
                if (existing.some((u) => u.phone === phone)) {
                  setCreateError("Số điện thoại đã tồn tại.");
                  return;
                }

                const user: AdminUser = {
                  employeeCode: form.employeeCode,
                  name,
                  phone,
                  role: form.role,
                  password: form.password,
                  active: true,
                  permissions:
                    form.role === "Admin"
                      ? {
                          view: PERMISSION_CATALOG.map((p) => p.id),
                          edit: PERMISSION_CATALOG.map((p) => p.id),
                        }
                      : {
                          view: Array.from(new Set(form.permissions.view)),
                          edit: Array.from(new Set(form.permissions.edit)),
                        },
                  createdAt: now,
                  updatedAt: now,
                };
                void (async () => {
                  const headers = await authHeader();
                  if (headers) {
                    const res = await fetch("/api/admin/users", {
                      method: "POST",
                      headers: { "content-type": "application/json", ...headers },
                      body: JSON.stringify(user),
                    });
                    if (!res.ok) {
                      let code = "failed";
                      let msg = "";
                      const ct = res.headers.get("content-type") ?? "";
                      if (ct.includes("application/json")) {
                        const d = (await res.json().catch(() => ({}))) as {
                          error?: string;
                          message?: string;
                        };
                        code = String(d.error ?? "failed");
                        msg = String(d.message ?? "");
                      } else {
                        const t = await res.text().catch(() => "");
                        code = `http_${res.status}`;
                        msg = t ? t.slice(0, 200) : "";
                      }
                      setCreateError(
                        code === "forbidden"
                          ? "Bạn chưa có quyền Admin (token chưa cập nhật). Vui lòng Logout rồi đăng nhập lại."
                          : code === "unauthorized"
                            ? "Phiên đăng nhập hết hạn. Vui lòng Logout rồi đăng nhập lại."
                            : code === "auth/phone-number-already-exists"
                          ? "Số điện thoại đã tồn tại trên Firebase."
                          : code === "auth/invalid-phone-number"
                            ? "Số điện thoại không hợp lệ (cần dạng +84...)."
                            : code === "auth/invalid-password"
                              ? "Mật khẩu không hợp lệ (tối thiểu 6 ký tự)."
                              : `Không thể tạo user. Lỗi: ${code}${msg ? ` — ${msg}` : ""}`,
                      );
                      return;
                    }
                    refresh();
                    setOpenCreate(false);
                    return;
                  }
                  // Fallback only when not signed in Firebase.
                  upsertUser(user);
                  refresh();
                  setOpenCreate(false);
                })();
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
          if (!v) {
            setEditUser(null);
            setEditError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa User</DialogTitle>
            <DialogDescription>
              Cập nhật thông tin tài khoản, vai trò và trạng thái hoạt động.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Mã Nhân Viên</label>
              <Input value={editForm.employeeCode} readOnly />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Tên Nhân Viên</label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((s) => ({ ...s, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Số Điện Thoại</label>
              <Input
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm((s) => ({ ...s, phone: formatPhone84(e.target.value) }))
                }
                placeholder="+84xxxxxxxxx"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Vai Trò</label>
              <select
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
                value={editForm.role}
                onChange={(e) =>
                  setEditForm((s) => ({ ...s, role: e.target.value as UserRole }))
                }
              >
                <option value="Admin">Admin</option>
                <option value="Accountant">Accountant</option>
                <option value="Sales">Sales</option>
                <option value="Operator">Operator</option>
                <option value="Driver">Driver</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={(e) =>
                  setEditForm((s) => ({ ...s, active: e.target.checked }))
                }
              />
              Hoạt động
            </label>

            {editError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {editError}
              </div>
            ) : null}

            <Button
              className="w-full text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              onClick={saveEditUser}
            >
              Lưu thay đổi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openPerms}
        onOpenChange={(v) => {
          setOpenPerms(v);
          if (!v) setPermsUser(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Phân quyền</DialogTitle>
            <DialogDescription>
              Tick chọn mục được <b>xem</b> và <b>sửa</b> cho user.
            </DialogDescription>
          </DialogHeader>

          {permsUser ? (
            <div className="space-y-4">
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/30">
                {permsUser.name} — {permsUser.phone}
              </div>

              <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-100 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                    <tr>
                      <th className="px-3 py-2">Mục</th>
                      <th className="px-3 py-2">Xem</th>
                      <th className="px-3 py-2">Sửa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {PERMISSION_CATALOG.map((p) => {
                      const canView = permsUser.permissions.view.includes(p.id);
                      const canEdit = permsUser.permissions.edit.includes(p.id);
                      return (
                        <tr key={p.id}>
                          <td className="px-3 py-2">{p.label}</td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={canView}
                              onChange={(e) => {
                                const next = e.target.checked;
                                const view = next
                                  ? Array.from(
                                      new Set([...permsUser.permissions.view, p.id]),
                                    )
                                  : permsUser.permissions.view.filter((x) => x !== p.id);
                                const edit = next
                                  ? permsUser.permissions.edit
                                  : permsUser.permissions.edit.filter((x) => x !== p.id);
                                setPermsUser({
                                  ...permsUser,
                                  permissions: { view, edit },
                                });
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={canEdit}
                              disabled={!canView}
                              onChange={(e) => {
                                const next = e.target.checked;
                                const edit = next
                                  ? Array.from(
                                      new Set([...permsUser.permissions.edit, p.id]),
                                    )
                                  : permsUser.permissions.edit.filter((x) => x !== p.id);
                                const view = Array.from(
                                  new Set([...permsUser.permissions.view, p.id]),
                                );
                                setPermsUser({
                                  ...permsUser,
                                  permissions: { view, edit },
                                });
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  const now = Date.now();
                  const next = { ...permsUser, updatedAt: now };
                  if (permsUser.uid) {
                    void (async () => {
                      const headers = await authHeader();
                      if (!headers) return;
                      await fetch(`/api/admin/users/${encodeURIComponent(permsUser.uid!)}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json", ...headers },
                        body: JSON.stringify({
                          role: next.role,
                          permissions: next.permissions,
                          active: next.active,
                          name: next.name,
                        }),
                      });
                      refresh();
                      setOpenPerms(false);
                    })();
                    return;
                  }
                  upsertUser(next);
                  refresh();
                  setOpenPerms(false);
                }}
              >
                Lưu
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <Input
        value={value}
        disabled={disabled}
        className={disabled ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-900" : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function PaymentField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <Input
        value={value}
        disabled={disabled}
        className={disabled ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-900" : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function PaymentCard({
  title,
  account,
  editing,
  onEditToggle,
  onShare,
  onChange,
  onCancel,
  onSave,
}: {
  title: string;
  account: PaymentAccount | undefined;
  editing: boolean;
  onEditToggle: () => void;
  onShare: () => void;
  onChange: (next: PaymentAccount) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const a = account ?? {
    bankName: "",
    accountNumber: "",
    accountHolder: "",
    updatedAt: Date.now(),
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            onClick={onEditToggle}
            aria-label={`Sửa ${title}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            onClick={onShare}
            aria-label={`Chia sẻ ${title}`}
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={!editing ? "pointer-events-none select-none" : ""}>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <PaymentField
            label="Tên Ngân Hàng"
            value={a.bankName}
            disabled={!editing}
            onChange={(v) => onChange({ ...a, bankName: v })}
          />
          <PaymentField
            label="Chi Nhánh"
            value={(a as any).branch ?? "Chi nhánh TPHCM"}
            disabled
            onChange={() => {}}
          />
        </div>

        <div className="mt-4 grid gap-4">
          <PaymentField
            label="Số Tài Khoản"
            value={a.accountNumber}
            disabled={!editing}
            onChange={(v) => onChange({ ...a, accountNumber: v })}
          />
          <PaymentField
            label="Tên Chủ Tài Khoản"
            value={a.accountHolder}
            disabled={!editing}
            onChange={(v) => onChange({ ...a, accountHolder: v })}
          />
        </div>
      </div>

      {editing ? (
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="h-9" onClick={onCancel}>
            Huỷ
          </Button>
          <Button
            className="h-9 bg-orange-500 text-white hover:bg-orange-600"
            onClick={onSave}
          >
            Lưu
          </Button>
        </div>
      ) : null}
    </div>
  );
}

async function shareAccount(title: string, account: PaymentAccount) {
  const text =
    `${title}\n` +
    `Tên ngân hàng: ${account.bankName}\n` +
    `Số tài khoản: ${account.accountNumber}\n` +
    `Tên chủ tài khoản: ${account.accountHolder}`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch {
      // fallthrough
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    alert("Đã copy thông tin tài khoản vào clipboard.");
  } catch {
    alert(text);
  }
}

