const asObject = (value: unknown): Record<string, any> | null =>
  value && typeof value === "object" ? (value as Record<string, any>) : null;

const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
const warnedKeys = new Set<string>();

const normalizeCode = (value: unknown, fallback = "") =>
  String(value || fallback)
    .trim()
    .toUpperCase();

const getGroupPayment = (group: unknown) => asObject(asObject(group)?.payment);

const warnDevOnce = (key: string, message: string) => {
  if (!isDev || warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(message);
};

// Defensive selectors only. Frontend must not derive split checkout lifecycle on its own.
// Prefer backend paymentReadModel/readModel and only fall back to raw fields for compatibility.
export const getGroupedPaymentReadModel = (group: unknown) => {
  const source = asObject(group);
  const payment = getGroupPayment(source);
  const readModel =
    asObject(source?.paymentReadModel) ?? asObject(payment?.readModel) ?? null;
  const hasRawGroupedPaymentState = Boolean(
    source &&
      (source.paymentStatus ||
        source.paymentStatusMeta ||
        payment?.status ||
        payment?.displayStatus ||
        payment?.displayStatusMeta)
  );
  if (!readModel && hasRawGroupedPaymentState) {
    warnDevOnce(
      "grouped-payment-read-model-fallback",
      "[groupedPaymentReadModel] Backend paymentReadModel missing. Rendering is falling back to raw split payment fields."
    );
  }
  const statusMeta =
    asObject(readModel?.statusMeta) ??
    asObject(payment?.displayStatusMeta) ??
    asObject(payment?.statusMeta) ??
    asObject(source?.paymentStatusMeta) ??
    null;
  const proofActionability =
    asObject(readModel?.proofActionability) ??
    asObject(payment?.proofActionability) ??
    { canStartProof: false, reason: null };
  const cancelability =
    asObject(readModel?.cancelability) ??
    asObject(payment?.cancelability) ??
    { canCancel: false, reason: null };
  const status = normalizeCode(
    readModel?.status ??
      payment?.displayStatus ??
      payment?.status ??
      source?.paymentStatus,
    "UNPAID"
  );

  return {
    status,
    statusMeta,
    rawStatus: normalizeCode(
      readModel?.rawStatus ?? payment?.status ?? source?.paymentStatus,
      status
    ),
    rawStatusMeta:
      asObject(readModel?.rawStatusMeta) ?? asObject(payment?.statusMeta) ?? statusMeta,
    settlementStatus: normalizeCode(
      readModel?.settlementStatus ?? source?.paymentStatus,
      "UNPAID"
    ),
    settlementStatusMeta:
      asObject(readModel?.settlementStatusMeta) ??
      asObject(source?.paymentStatusMeta) ??
      statusMeta,
    proofActionability,
    cancelability,
    expiresAt: payment?.expiresAt ?? readModel?.expiresAt ?? null,
    isFinal: Boolean(readModel?.isFinal ?? statusMeta?.isFinal),
    isActionable: Boolean(
      readModel?.isActionable ??
        proofActionability?.canStartProof ??
        cancelability?.canCancel
    ),
  };
};

export const isGroupedPaymentFinal = (group: unknown) =>
  Boolean(getGroupedPaymentReadModel(group).isFinal);

export const shouldPollGroupedPaymentGroups = (groups: unknown) =>
  Array.isArray(groups) &&
  groups.some((group) => {
    const readModel = getGroupedPaymentReadModel(group);
    return (
      !readModel.isFinal &&
      ["CREATED", "REJECTED", "PENDING_CONFIRMATION"].includes(readModel.status)
    );
  });

export const hasGroupedPaymentDeadlinePassed = (group: unknown, now: number) => {
  const readModel = getGroupedPaymentReadModel(group);
  if (!["CREATED", "REJECTED"].includes(readModel.status)) return false;
  const expiresTime = new Date(String(readModel.expiresAt || "")).getTime();
  if (!Number.isFinite(expiresTime)) return false;
  return expiresTime <= now;
};
