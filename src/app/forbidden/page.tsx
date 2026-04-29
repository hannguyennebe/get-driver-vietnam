"use client";

import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="min-h-full flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Không có quyền truy cập
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Tài khoản của bạn không được cấp quyền để xem trang này.
        </p>
        <div className="mt-5 flex gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Về Dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            Đăng nhập lại
          </Link>
        </div>
      </div>
    </div>
  );
}

