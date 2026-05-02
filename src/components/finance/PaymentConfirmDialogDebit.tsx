"use client";

import * as React from "react";
import { PaymentConfirmDialogCore, type PaymentConfirmDialogCoreProps } from "./PaymentConfirmDialogCore";

export type PaymentConfirmDialogDebitProps = Omit<PaymentConfirmDialogCoreProps, "walletVariant">;

export function PaymentConfirmDialogDebit(props: PaymentConfirmDialogDebitProps) {
  return <PaymentConfirmDialogCore {...props} walletVariant="debit" />;
}

/** Mặc định: chi / trừ ví — kiểm tra số dư khi nguồn là ví. */
export const PaymentConfirmDialog = PaymentConfirmDialogDebit;
