"use client";

import * as React from "react";
import { PaymentConfirmDialogCore, type PaymentConfirmDialogCoreProps } from "./PaymentConfirmDialogCore";

export type PaymentConfirmDialogCreditProps = Omit<PaymentConfirmDialogCoreProps, "walletVariant">;

export function PaymentConfirmDialogCredit(props: PaymentConfirmDialogCreditProps) {
  return <PaymentConfirmDialogCore {...props} walletVariant="credit" />;
}
