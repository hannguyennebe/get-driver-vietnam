"use client";

import * as React from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type Auth,
} from "firebase/auth";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { initFirebaseAuth } from "@/lib/firebase/client";
import {
  phoneToLegacySyntheticEmail,
  normalizeUsernameToPhone,
  phoneToSyntheticEmail,
} from "@/lib/auth/username";
import { useRouter } from "next/navigation";
import { setDemoSession } from "@/lib/auth/demo";
import { ensureAdminStore, validateDemoLogin } from "@/lib/admin/usersStore";
import type { UserRole } from "@/lib/admin/usersStore";

type ForgotStep = "identify" | "otp" | "reset";

const REMEMBER_KEY = "getdriver.remember";
const CREDS_KEY = "getdriver.creds";

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [firebaseAuth, setFirebaseAuth] = React.useState<Auth | null>(null);
  const [firebaseChecked, setFirebaseChecked] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    // Avoid initializing Firebase during server prerender.
    let cancelled = false;
    void (async () => {
      const auth = await initFirebaseAuth();
      if (cancelled) return;
      setFirebaseAuth(auth);
      setFirebaseChecked(true);
    })();

    // Seed demo data for admin/users management.
    ensureAdminStore();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const remembered = localStorage.getItem(REMEMBER_KEY) === "1";
    setRemember(remembered);
    if (remembered) {
      const creds = safeJsonParse<{ username: string; password: string }>(
        localStorage.getItem(CREDS_KEY),
      );
      if (creds) {
        setUsername(creds.username ?? "");
        setPassword(creds.password ?? "");
      }
    }
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Demo login when Firebase isn't configured yet.
    if (!firebaseAuth) {
      const phone = normalizeUsernameToPhone(username);
      const role = validateDemoLogin(phone, password);
      if (!role) {
        setError("Sai tên đăng nhập hoặc mật khẩu.");
        return;
      }
      setDemoSession({ username: phone, role, createdAt: Date.now() });
      router.replace("/dashboard");
      return;
    }

    setBusy(true);
    try {
      const phone = normalizeUsernameToPhone(username);
      const email = phoneToSyntheticEmail(phone);
      const legacyEmail = phoneToLegacySyntheticEmail(phone);
      let signedInUser: Auth["currentUser"] | null = null;
      try {
        const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
        signedInUser = cred.user;
      } catch {
        if (legacyEmail !== email) {
          const cred = await signInWithEmailAndPassword(
            firebaseAuth,
            legacyEmail,
            password,
          );
          signedInUser = cred.user;
        } else {
          throw new Error("login_failed");
        }
      }

      const token = await signedInUser?.getIdToken();
      const tokenResult = await signedInUser?.getIdTokenResult();
      const role = (tokenResult?.claims?.role as UserRole | undefined) ?? "Admin";
      const perms = (tokenResult?.claims as any)?.perms as
        | { view?: string[]; edit?: string[] }
        | undefined;
      const permissions = {
        view: Array.isArray(perms?.view) ? perms!.view! : [],
        edit: Array.isArray(perms?.edit) ? perms!.edit! : [],
      };
      setDemoSession({ username: phone, role, permissions, createdAt: Date.now() });

      if (remember) {
        localStorage.setItem(REMEMBER_KEY, "1");
        localStorage.setItem(CREDS_KEY, JSON.stringify({ username, password }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
        localStorage.removeItem(CREDS_KEY);
      }

      router.replace("/dashboard");
    } catch (err) {
      setError("Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Đăng nhập</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Get Driver Vietnam Operations Center
          </p>
        </div>

        {firebaseChecked && !firebaseAuth ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Firebase chưa được cấu hình nên app đang ở <b>Demo mode</b>. Bạn có
            thể bấm Login để vào và mình chỉnh UI tiếp, nhưng OTP/đổi mật khẩu sẽ
            chưa hoạt động.
          </div>
        ) : null}

        <form onSubmit={onLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Tên đăng nhập</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Số điện thoại (ví dụ: +84901234567)"
              autoComplete="username"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Password</label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <Checkbox
                checked={remember}
                onCheckedChange={(v) => setRemember(Boolean(v))}
              />
              Lưu thông tin đăng nhập
            </label>

            <ForgotPasswordDialog
              firebaseAuth={firebaseAuth ?? undefined}
              defaultUsername={username}
              onPasswordChanged={() => {
                // Optional: clear password field after reset
                setPassword("");
              }}
            />
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={busy || !username.trim() || !password}
          >
            {busy ? "Đang đăng nhập..." : "Login"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function ForgotPasswordDialog({
  firebaseAuth,
  defaultUsername,
  onPasswordChanged,
}: {
  firebaseAuth?: Auth;
  defaultUsername: string;
  onPasswordChanged: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<ForgotStep>("identify");
  const [username, setUsername] = React.useState(defaultUsername);
  const [otp, setOtp] = React.useState("");
  const [newPass, setNewPass] = React.useState("");
  const [confirmPass, setConfirmPass] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmation, setConfirmation] =
    React.useState<ConfirmationResult | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setStep("identify");
    setOtp("");
    setNewPass("");
    setConfirmPass("");
    setError(null);
    setConfirmation(null);
    setUsername(defaultUsername);
  }, [open, defaultUsername]);

  async function ensureRecaptcha() {
    if (!firebaseAuth) throw new Error("missing auth");
    const w = window as unknown as {
      __getdriverRecaptcha?: RecaptchaVerifier;
    };
    if (w.__getdriverRecaptcha) return w.__getdriverRecaptcha;
    const verifier = new RecaptchaVerifier(firebaseAuth, "recaptcha-container", {
      size: "invisible",
    });
    w.__getdriverRecaptcha = verifier;
    return verifier;
  }

  async function onSendOtp() {
    setError(null);
    setBusy(true);
    try {
      if (!firebaseAuth) throw new Error("missing auth");
      const phone = normalizeUsernameToPhone(username);
      if (!phone) throw new Error("missing phone");
      const verifier = await ensureRecaptcha();
      const res = await signInWithPhoneNumber(firebaseAuth, phone, verifier);
      setConfirmation(res);
      setStep("otp");
    } catch (e) {
      setError("Không gửi được OTP. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp() {
    setError(null);
    setBusy(true);
    try {
      if (!confirmation) throw new Error("missing confirmation");
      await confirmation.confirm(otp);
      setStep("reset");
    } catch (e) {
      setError("Mã OTP không đúng hoặc đã hết hạn.");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveNewPassword() {
    setError(null);
    if (newPass.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPass !== confirmPass) {
      setError("Mật khẩu không trùng khớp.");
      return;
    }

    setBusy(true);
    try {
      if (!firebaseAuth) throw new Error("missing auth");
      const user = firebaseAuth.currentUser;
      if (!user) {
        throw new Error("Phiên xác thực không hợp lệ. Vui lòng gửi OTP lại.");
      }
      await updatePassword(user, newPass);

      // Sign out the temporary phone session
      await signOut(firebaseAuth);
      onPasswordChanged();
      setOpen(false);
    } catch (e) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "Không thể đổi mật khẩu. Vui lòng thử lại.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        className="text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
        onClick={() => setOpen(true)}
      >
        Quên Mật Khẩu
      </button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quên mật khẩu</DialogTitle>
          <DialogDescription>
            Xác minh OTP gửi về số điện thoại đăng ký.
          </DialogDescription>
        </DialogHeader>

        <div id="recaptcha-container" />

        {step === "identify" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tên đăng nhập</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="+84901234567"
              />
            </div>
            <Button
              type="button"
              className="w-full text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              disabled={busy || !username.trim()}
              onClick={onSendOtp}
            >
              {busy ? "Đang gửi..." : "Gửi OTP"}
            </Button>
          </div>
        ) : null}

        {step === "otp" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Mã OTP</label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Nhập mã OTP"
                inputMode="numeric"
              />
            </div>
            <Button
              type="button"
              className="w-full text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              disabled={busy || otp.trim().length < 4}
              onClick={onVerifyOtp}
            >
              {busy ? "Đang verify..." : "Verify"}
            </Button>
          </div>
        ) : null}

        {step === "reset" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Mật khẩu mới</label>
              <Input
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                type="password"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Xác nhận mật khẩu mới
              </label>
              <Input
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                type="password"
              />
            </div>
            <Button
              type="button"
              className="w-full text-zinc-900 shadow-sm bg-gradient-to-b from-[#E6C36A] to-[#C79A2B] hover:from-[#EBCB7A] hover:to-[#B98A1F] active:from-[#DDBA5D] active:to-[#A87912]"
              disabled={busy || !newPass || !confirmPass}
              onClick={onSaveNewPassword}
            >
              {busy ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

