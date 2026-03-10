import { PaymentStatusLog } from "../models/index.js";

export type PaymentStatusLogActorType =
  | "SYSTEM"
  | "BUYER"
  | "SELLER"
  | "ADMIN"
  | "WEBHOOK";

type AppendPaymentStatusLogInput = {
  paymentId: number;
  oldStatus?: string | null;
  newStatus: string;
  actorType: PaymentStatusLogActorType;
  actorId?: number | null;
  note?: string | null;
};

const normalizeStatus = (value?: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized || null;
};

export const appendPaymentStatusLog = async (
  input: AppendPaymentStatusLogInput,
  transaction?: any
) => {
  const paymentId = Number(input.paymentId || 0);
  const newStatus = normalizeStatus(input.newStatus);
  if (!paymentId || !newStatus) {
    throw new Error("Invalid payment status log payload.");
  }

  await PaymentStatusLog.create(
    {
      paymentId,
      oldStatus: normalizeStatus(input.oldStatus),
      newStatus,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      note: input.note ? String(input.note).trim() || null : null,
    } as any,
    transaction ? { transaction } : undefined
  );
};
